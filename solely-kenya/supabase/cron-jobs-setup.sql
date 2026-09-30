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
-- 2. AUTO-RELEASE ESCROW
-- ================================================================
-- Runs every 10 minutes
-- Releases escrow funds 24 hours after order marked "arrived"
-- Only for delivery orders (pickup orders have no time limit)
-- ================================================================

SELECT cron.schedule(
    'auto-release-escrow',
    '*/10 * * * *', -- Every 10 minutes
    $$
    SELECT
      net.http_post(
          url:='https://cqcklvdblhcdowisjnsf.supabase.co/functions/v1/auto-release-escrow',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- ================================================================
-- 3. AUTO-DISPUTE UNDELIVERED ORDERS
-- ================================================================
-- Runs every hour
-- Creates dispute for orders not marked "arrived" within 5 days
-- Admin will follow up with vendor (buyer might be okay with delay)
-- Skips pickup orders (no time limits)
-- ================================================================

SELECT cron.schedule(
    'auto-dispute-undelivered',
    '0 * * * *', -- Every hour at minute 0
    $$
    SELECT
      net.http_post(
          url:='https://cqcklvdblhcdowisjnsf.supabase.co/functions/v1/auto-refund-unshipped',
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
-- SELECT cron.unschedule('auto-release-escrow');
-- SELECT cron.unschedule('auto-dispute-undelivered');
-- SELECT cron.unschedule('auto-refund-unshipped'); -- Old job, remove if exists

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
-- TIMELINE SUMMARY (as of December 2024)
-- ================================================================
-- Vendor Confirmation: 48 hours → auto-cancel + refund
-- Delivery Window: 5 days → auto-dispute for admin review
-- Buyer Verification: 24 hours after "arrived" → auto-release
-- Pickup Orders: No time limits (exempt from auto-release)
-- ================================================================
