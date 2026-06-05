-- Post-recovery cleanup: Recalculate vendor_balances from order + payout history
-- Run this in Supabase SQL Editor to ensure DB balances match reality.

-- Step 0: Make order_id nullable (withdrawals aren't tied to a single order)
ALTER TABLE payouts ALTER COLUMN order_id DROP NOT NULL;

-- Step 1: Recalculate total_earned from completed orders
UPDATE vendor_balances vb
SET 
  total_earned = COALESCE(order_totals.total, 0),
  updated_at = NOW()
FROM (
  SELECT vendor_id, SUM(payout_amount) as total
  FROM orders
  WHERE status = 'completed'
  GROUP BY vendor_id
) order_totals
WHERE vb.vendor_id = order_totals.vendor_id;

-- Step 2: Recalculate total_paid_out from payouts
UPDATE vendor_balances vb
SET 
  total_paid_out = COALESCE(payout_totals.total, 0),
  pending_balance = GREATEST(0, COALESCE(vb.total_earned, 0) - COALESCE(payout_totals.total, 0)),
  updated_at = NOW()
FROM (
  SELECT vendor_id, SUM(amount_ksh) as total
  FROM payouts
  WHERE status IN ('paid', 'processing')
  GROUP BY vendor_id
) payout_totals
WHERE vb.vendor_id = payout_totals.vendor_id;

-- Step 3: Verify the results
SELECT 
  vb.vendor_id,
  p.email,
  p.store_name,
  vb.pending_balance,
  vb.total_earned,
  vb.total_paid_out,
  vb.intasend_wallet_id
FROM vendor_balances vb
JOIN profiles p ON p.id = vb.vendor_id
ORDER BY vb.total_earned DESC;
