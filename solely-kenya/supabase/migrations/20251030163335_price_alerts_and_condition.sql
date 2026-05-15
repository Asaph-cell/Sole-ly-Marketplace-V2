-- Migration: Add shoe condition and price alerts features

-- 1. Add condition column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'new' 
CHECK (condition IN ('new', 'like_new', 'good', 'fair'));

-- 2. Add condition_notes for seller descriptions
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS condition_notes TEXT;

-- 3. Create price_alerts table for "Notify me when price drops" feature
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  target_price NUMERIC,  -- Optional: notify when price goes below this
  original_price NUMERIC NOT NULL,  -- Price when alert was created
  created_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ,  -- When notification was sent
  is_active BOOLEAN DEFAULT true,
  
  -- Unique constraint: one alert per user per product
  UNIQUE(user_id, product_id)
);

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_price_alerts_product ON price_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;

-- 5. Add RLS policies for price_alerts
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Users can see their own alerts
CREATE POLICY "Users can view own price alerts"
ON price_alerts FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own alerts
CREATE POLICY "Users can create own price alerts"
ON price_alerts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own alerts
CREATE POLICY "Users can delete own price alerts"
ON price_alerts FOR DELETE
USING (auth.uid() = user_id);

-- Users can update their own alerts
CREATE POLICY "Users can update own price alerts"
ON price_alerts FOR UPDATE
USING (auth.uid() = user_id);

-- 6. Create function to check for price drops and notify users
-- (This will be called by a cron job or trigger)
CREATE OR REPLACE FUNCTION check_price_drop_alerts()
RETURNS void AS $$
DECLARE
  alert_record RECORD;
BEGIN
  FOR alert_record IN
    SELECT 
      pa.id,
      pa.user_id,
      pa.product_id,
      pa.original_price,
      pa.target_price,
      p.price_ksh as current_price,
      p.name as product_name,
      prof.email as user_email
    FROM price_alerts pa
    JOIN products p ON pa.product_id = p.id
    JOIN profiles prof ON pa.user_id = prof.id
    WHERE pa.is_active = true
      AND pa.notified_at IS NULL
      AND (
        (pa.target_price IS NOT NULL AND p.price_ksh <= pa.target_price)
        OR (pa.target_price IS NULL AND p.price_ksh < pa.original_price)
      )
  LOOP
    -- Mark as notified (actual email sending happens via Edge Function)
    UPDATE price_alerts 
    SET notified_at = now(), is_active = false 
    WHERE id = alert_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
