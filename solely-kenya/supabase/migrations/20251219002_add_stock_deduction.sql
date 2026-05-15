-- Migration to add function for deducting stock logic
CREATE OR REPLACE FUNCTION deduct_order_items_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT product_id, quantity
    FROM order_items
    WHERE order_id = p_order_id
  LOOP
    UPDATE products
    SET stock = GREATEST(0, stock - item.quantity)
    WHERE id = item.product_id;
  END LOOP;
END;
$$;
