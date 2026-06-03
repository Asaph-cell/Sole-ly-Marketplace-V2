-- ============================================================
-- FIX GUEST TRACKING RPC
-- Date: 2026-06-03
-- Removes the customer_id IS NULL check so that UUID tracking 
-- links from emails work for authenticated users too.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_guest_order_details(target_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS internally
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'product_id', o.product_id,
    'vendor_id', o.vendor_id,
    'buyer_name', o.buyer_name,
    'buyer_phone', o.buyer_phone,
    'buyer_email', o.buyer_email,
    'quantity', o.quantity,
    'total_price_ksh', o.total_price_ksh,
    'status', o.status,
    'delivery_address', o.delivery_address,
    'notes', o.notes,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'customer_id', o.customer_id,
    'payment_link_id', o.payment_link_id,
    'delivery_code', o.delivery_code,
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
    'order_shipping_details', COALESCE(
      (
        SELECT jsonb_agg(row_to_json(osd.*))
        FROM public.order_shipping_details osd
        WHERE osd.order_id = o.id
      ), 
      '[]'::jsonb
    )
  )
  INTO result
  FROM public.orders o
  WHERE o.id = target_order_id; -- Removed the customer_id IS NULL check

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_order_details(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_guest_order_details(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
