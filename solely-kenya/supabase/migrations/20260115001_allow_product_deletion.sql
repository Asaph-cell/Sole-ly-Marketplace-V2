-- Allow product deletion by changing order_items FK to SET NULL
-- Order history is preserved via product_name and product_snapshot columns

-- Make product_id nullable
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;

-- Drop existing foreign key and recreate with SET NULL
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items 
  ADD CONSTRAINT order_items_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES products(id) 
  ON DELETE SET NULL;
