-- Add order_id to reviews table to link reviews to orders
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

-- Add unique constraint to prevent duplicate reviews for same order and product
-- Only applies when order_id is not null (allows legacy reviews without order_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order_product_unique 
ON public.reviews(order_id, product_id) 
WHERE order_id IS NOT NULL;

-- Update RLS policy to ensure users can only review products from their completed orders
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.reviews;

CREATE POLICY "Users can create reviews for their completed orders" 
ON public.reviews 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND (
    order_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND o.customer_id = auth.uid()
      AND o.status = 'completed'
    )
  )
);

-- Allow users to update their own reviews
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews" 
ON public.reviews 
FOR UPDATE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

