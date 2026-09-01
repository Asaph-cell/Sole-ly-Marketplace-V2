# Cron Jobs Setup Guide

This guide explains how to set up scheduled cron jobs for Solely Marketplace **securely** using Supabase Vault secrets.

> ⚠️ **NEVER hardcode service keys in migration files or code!**

## Prerequisites

1. Enable required extensions in Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
GRANT USAGE ON SCHEMA cron TO postgres;
```

2. Store your service key as a Vault secret (run in SQL Editor):
```sql
SELECT vault.create_secret(
  'YOUR_SERVICE_ROLE_KEY_HERE',
  'supabase_service_key',
  'Service role key for cron job auth'
);
```

## Cron Jobs

Run these in Supabase SQL Editor to set up the cron jobs:

### 1. Auto-Cancel Stale Orders (hourly)
Cancels orders not confirmed by vendor within 48 hours.

```sql
SELECT cron.schedule(
  'auto-cancel-stale-orders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/auto-cancel-stale-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 2. Auto-Release Escrow (hourly at :30)
Releases funds to vendor after buyer verification period.

```sql
SELECT cron.schedule(
  'auto-release-escrow',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/auto-release-escrow',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 3. Auto-Refund Unshipped Orders (every 6 hours)
Refunds orders not shipped within 5 days.

```sql
SELECT cron.schedule(
  'auto-refund-unshipped',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/auto-refund-unshipped',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 4. Process Payouts (daily at 6 AM)
Processes vendor payouts.

```sql
SELECT cron.schedule(
  'process-payouts',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-payouts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Managing Cron Jobs

View all scheduled jobs:
```sql
SELECT * FROM cron.job;
```

Remove a job:
```sql
SELECT cron.unschedule('job-name-here');
```

View job history:
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

## After Key Rotation

If you rotate your service key, update the vault secret:
```sql
UPDATE vault.secrets 
SET secret = 'NEW_SERVICE_ROLE_KEY_HERE'
WHERE name = 'supabase_service_key';
```
