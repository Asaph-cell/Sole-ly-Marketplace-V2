-- Add structured specs column to products table
-- Used for category-specific attributes:
--   Electronics: { model, brand, year, storage, ram, color, condition, accessories }
--   Clothing:    { size, gender, material }
--   Shoes:       (continues using sizes[] / colors[] as before)
--   etc.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS specs jsonb DEFAULT '{}';

-- Index for querying specs fields (e.g. all 128GB iPhones)
CREATE INDEX IF NOT EXISTS idx_products_specs
  ON products USING gin (specs);

COMMENT ON COLUMN products.specs IS
  'Category-specific structured attributes. E.g. {"model":"iPhone 14","storage":"128GB","ram":"6GB","year":2023}';
