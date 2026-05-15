-- Remove subscription checks from publish_product to support commission-based model
CREATE OR REPLACE FUNCTION public.publish_product(product_id_to_publish uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_vendor_id uuid;
BEGIN
  -- 1. Get the current user's ID from the session
  current_vendor_id := auth.uid();

  -- 2. Ensure user is authenticated
  IF current_vendor_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  -- 3. Publish the product by setting its status to 'active'
  -- Only allow publishing if the product belongs to the current user
  UPDATE public.products
  SET status = 'active'
  WHERE id = product_id_to_publish
    AND vendor_id = current_vendor_id;

  -- 4. Check if the update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND_OR_NOT_OWNED';
  END IF;

END;
$$;
