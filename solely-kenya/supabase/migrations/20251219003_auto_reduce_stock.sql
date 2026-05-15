-- Create trigger to automatically reduce stock when payment is captured
-- This ensures stock is updated when customers complete their payment

-- Function to reduce product stock based on order items
CREATE OR REPLACE FUNCTION reduce_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Only reduce stock when payment status changes to 'captured'
  IF NEW.status = 'captured' AND (OLD.status IS NULL OR OLD.status != 'captured') THEN
    
    -- Reduce stock for each item in the order
    UPDATE products p
    SET stock = GREATEST(0, p.stock - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.order_id
      AND oi.product_id = p.id
      AND p.stock IS NOT NULL;  -- Only update if stock tracking is enabled
    
    -- Log the stock reduction
    RAISE NOTICE 'Stock reduced for order %', NEW.order_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS trigger_reduce_stock ON payments;

CREATE TRIGGER trigger_reduce_stock
  AFTER INSERT OR UPDATE OF status
  ON payments
  FOR EACH ROW
  EXECUTE FUNCTION reduce_product_stock();

-- Add comment for documentation
COMMENT ON FUNCTION reduce_product_stock() IS 'Automatically reduces product stock when a payment is captured';
