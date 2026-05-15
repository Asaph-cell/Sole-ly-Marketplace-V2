-- ================================================================
-- ENABLE AUTOMATIC PAYOUTS (Hourly Check) — V2
-- Safe: skips if pg_cron not yet enabled via Supabase dashboard
-- To enable: Dashboard > Extensions > Enable pg_cron + pg_net
-- ================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN PERFORM cron.unschedule('process-auto-payouts'); EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'pg_cron available. Schedule cron job manually via Supabase Dashboard > Cron Jobs.';
  ELSE
    RAISE NOTICE 'pg_cron not enabled. Enable it via Supabase Dashboard > Extensions.';
  END IF;
END $$;

-- NOTE: To schedule the auto-release payout, go to Supabase Dashboard > Cron Jobs and add:
-- Name: process-auto-payouts
-- Schedule: 0 * * * *  (every hour)
-- Function: check-and-process-payouts


