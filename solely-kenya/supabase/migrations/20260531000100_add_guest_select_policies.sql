-- ============================================================
-- ADD GUEST SELECT POLICIES
-- Date: 2026-05-31
-- Allows: Guest/anonymous buyers to view their order tracking pages
-- ============================================================

-- Drop existing policies if they exist to prevent conflicts
DROP POLICY IF EXISTS "orders_select_anonymous" ON public.orders;
DROP POLICY IF EXISTS "order_shipping_select_anonymous" ON public.order_shipping_details;
DROP POLICY IF EXISTS "order_items_select_anonymous" ON public.order_items;
DROP POLICY IF EXISTS "payments_select_anonymous" ON public.payments;

-- 1. Orders Guest Select Policy
CREATE POLICY "orders_select_anonymous" ON public.orders
  FOR SELECT
  USING (customer_id IS NULL);

-- 2. Order Shipping Details Guest Select Policy
CREATE POLICY "order_shipping_select_anonymous" ON public.order_shipping_details
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_shipping_details.order_id
        AND o.customer_id IS NULL
    )
  );

-- 3. Order Items Guest Select Policy
CREATE POLICY "order_items_select_anonymous" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_id IS NULL
    )
  );

-- 4. Payments Guest Select Policy
CREATE POLICY "payments_select_anonymous" ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.customer_id IS NULL
    )
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
