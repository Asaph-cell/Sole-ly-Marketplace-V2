-- ================================================================
-- DISABLE AUTOMATIC PAYOUTS & CREATE VENDOR WALLETS
-- Safe version: skips cron calls on fresh DB instances
-- ================================================================

-- Step 1: Disable the old automatic payout cron job (safe: skips if cron not enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('process-auto-payouts');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, skipping unschedule';
END $$;

-- Note: Vendor wallets are created on-demand via the create-vendor-wallet edge function

