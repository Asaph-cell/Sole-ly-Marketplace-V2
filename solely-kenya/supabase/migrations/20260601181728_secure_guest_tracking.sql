-- ============================================================
-- SECURE GUEST TRACKING MIGRATION
-- Date: 2026-06-01
-- Replaces insecure anonymous SELECT policies with a secure RPC
-- ============================================================

-- 1. Drop the overly permissive anonymous select policies
DROP POLICY IF EXISTS "orders_select_anonymous" ON public.orders;
DROP POLICY IF EXISTS "order_shipping_select_anonymous" ON public.order_shipping_details;
DROP POLICY IF EXISTS "order_items_select_anonymous" ON public.order_items;
DROP POLICY IF EXISTS "payments_select_anonymous" ON public.payments;

-- 2. Create the Security Definer RPC for guest tracking
-- This function allows a guest to fetch their order ONLY if they know the exact UUID.
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
  WHERE o.id = target_order_id 
    AND o.customer_id IS NULL; -- Ensure it's actually a guest order

  RETURN result;
END;
$$;

-- Ensure anonymous users can call this RPC
GRANT EXECUTE ON FUNCTION public.get_guest_order_details(UUID) TO anon;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
