-- ============================================================
-- FIX GUEST TRACKING RPC - Use correct column names
-- Date: 2026-06-03
-- The old function referenced columns that no longer exist
-- (buyer_name, buyer_phone, product_id, quantity, etc.)
-- This version uses the actual current schema.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_guest_order_details(target_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'vendor_id', o.vendor_id,
    'customer_id', o.customer_id,
    'status', o.status,
    'subtotal_ksh', o.subtotal_ksh,
    'shipping_fee_ksh', o.shipping_fee_ksh,
    'total_ksh', o.total_ksh,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'payment_link_id', o.payment_link_id,
    'delivery_otp', o.delivery_otp,
    'buyer_confirmed', o.buyer_confirmed,
    'vendor', (
      SELECT jsonb_build_object(
        'store_name', p.store_name,
        'full_name', p.full_name,
        'whatsapp_number', p.whatsapp_number,
        'store_link', p.store_link
      )
      FROM public.profiles p
      WHERE p.id = o.vendor_id
    ),
    'order_shipping_details', (
      SELECT row_to_json(osd.*)
      FROM public.order_shipping_details osd
      WHERE osd.order_id = o.id
      LIMIT 1
    ),
    'order_items', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'unit_price_ksh', oi.unit_price_ksh
        ))
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  INTO result
  FROM public.orders o
  WHERE o.id = target_order_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_order_details(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_guest_order_details(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
