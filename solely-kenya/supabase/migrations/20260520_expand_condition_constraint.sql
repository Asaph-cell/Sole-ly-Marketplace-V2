-- Expand condition constraint to support all marketplace condition types
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_condition_check;

ALTER TABLE products
  ADD CONSTRAINT products_condition_check
  CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'thrifted', 'refurbished'));
