-- ================================================================
-- Solely - CRON JOBS SETUP
-- ================================================================
-- This SQL script schedules automated order management cron jobs
-- Run this in your Supabase SQL Editor after deploying Edge Functions
-- ================================================================
-- UPDATED: December 2024 - New timeline system
-- - Vendor confirmation: 48 hours (was 24h)
-- - Delivery window: 5 days auto-dispute (was 3 days refund)
-- - Buyer verification: 24 hours auto-release (arrived status)
-- ================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ================================================================
-- 1. AUTO-CANCEL STALE ORDERS
-- ================================================================
-- Runs every 15 minutes
-- Cancels orders where vendor hasn't responded within 48 hours
-- ================================================================

SELECT cron.schedule(
    'auto-cancel-stale-orders',
    '*/15 * * * *', -- Every 15 minutes
    $$
    SELECT
      net.http_post(
          url:='https://cqcklvdblhcdowisjnsf.supabase.co/functions/v1/auto-cancel-stale-orders',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- ================================================================
-- 2. ORDER ENGINE (dispute & delivery clocks)
-- ================================================================
-- Runs every 5 minutes. Drives every order clock in order_timers:
-- ship deadline (A1), delivery window (A4), 6h payment release,
-- packing-checklist holds, dispute response/negotiation windows,
-- fixes, returns and "buyer unavailable" grace periods.
-- See docs/DISPUTE_SYSTEM_SPEC.md.
--
-- Replaces the old 'auto-release-escrow' and 'auto-dispute-undelivered'
-- jobs - unschedule those first (their functions no longer exist):
--   SELECT cron.unschedule('auto-release-escrow');
--   SELECT cron.unschedule('auto-dispute-undelivered');
-- ================================================================

SELECT cron.schedule(
    'order-engine',
    '*/5 * * * *', -- Every 5 minutes
    $$
    SELECT
      net.http_post(
          url:='https://cqcklvdblhcdowisjnsf.supabase.co/functions/v1/order-engine',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- ================================================================
-- VIEW SCHEDULED CRON JOBS
-- ================================================================
-- Run this to see all scheduled jobs

SELECT * FROM cron.job;

-- ================================================================
-- UNSCHEDULE JOBS (if needed)
-- ================================================================
-- Run these if you need to remove/update a cron job

-- SELECT cron.unschedule('auto-cancel-stale-orders');
-- SELECT cron.unschedule('order-engine');
-- Retired jobs (functions deleted 2026-10-07), remove if still scheduled:
-- SELECT cron.unschedule('auto-release-escrow');
-- SELECT cron.unschedule('auto-dispute-undelivered');
-- SELECT cron.unschedule('auto-refund-unshipped');

-- ================================================================
-- NOTES
-- ================================================================
-- 1. Replace 'your-project-ref' with your actual Supabase project reference
-- 2. Replace 'YOUR_SUPABASE_SERVICE_ROLE_KEY' with your actual service role key
--    (Found in Supabase Dashboard > Settings > API)
-- 3. Cron jobs run in UTC timezone
-- 4. Make sure Edge Functions are deployed before scheduling
-- ================================================================

-- ================================================================
-- TIMELINE SUMMARY (as of October 2026)
-- ================================================================
-- Vendor Confirmation: 48 hours → auto-cancel + refund
-- Ship after accepting: 8 daytime hours → refund + vendor strike
-- Delivery: 24-72h by distance (10 days East Africa) → refund + strike
-- Payment release: 6 daytime hours after "arrived" → paid to vendor
-- Pickup Orders: no auto-release
-- All windows are editable in Admin > Settings.
-- ================================================================
