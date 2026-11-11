-- ============================================================
-- Schedule order-engine; retire the jobs it replaces
-- ============================================================
-- The dispute system (20261007000100) runs every order clock from the
-- order-engine edge function, every 5 minutes. The old jobs call
-- functions that no longer exist.
--
-- The new job copies the old auto-release-escrow job's command (URL and
-- service-role Authorization header) and only swaps the function name, so
-- the key never has to be written into a migration.
-- ============================================================

do $$
declare
  cmd text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise warning 'pg_cron is not enabled: schedule order-engine by hand (see cron-jobs-setup.sql)';
    return;
  end if;

  select command into cmd from cron.job where jobname = 'auto-release-escrow';
  if cmd is null then
    select command into cmd from cron.job where command like '%/functions/v1/auto-cancel-stale-orders%' limit 1;
    if cmd is not null then
      cmd := replace(cmd, '/functions/v1/auto-cancel-stale-orders', '/functions/v1/auto-release-escrow');
    end if;
  end if;

  if cmd is null then
    raise warning 'No existing job to copy: schedule order-engine by hand (see cron-jobs-setup.sql)';
  elsif not exists (select 1 from cron.job where jobname = 'order-engine') then
    perform cron.schedule('order-engine', '*/5 * * * *', replace(cmd, '/functions/v1/auto-release-escrow', '/functions/v1/order-engine'));
    raise notice 'order-engine scheduled every 5 minutes';
  end if;

  if exists (select 1 from cron.job where jobname = 'auto-release-escrow') then
    perform cron.unschedule('auto-release-escrow');
  end if;
  if exists (select 1 from cron.job where jobname = 'auto-dispute-undelivered') then
    perform cron.unschedule('auto-dispute-undelivered');
  end if;
  if exists (select 1 from cron.job where jobname = 'auto-refund-unshipped') then
    perform cron.unschedule('auto-refund-unshipped');
  end if;
end $$;
