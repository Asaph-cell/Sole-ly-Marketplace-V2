-- ============================================================
-- deduct_order_items_stock has no internal caller check (unlike
-- publish_product, which verifies vendor_id = auth.uid(), or
-- get_guest_order_details, which filters rows to the caller). Anyone who
-- knows a single valid order_id (e.g. their own past order) could call
-- supabase.rpc('deduct_order_items_stock', { p_order_id }) repeatedly to
-- zero out that order's products' stock. It's meant to be called from
-- trusted server-side order-processing paths, not directly by a client.
-- ============================================================

revoke execute on function public.deduct_order_items_stock(uuid) from public, anon, authenticated;
