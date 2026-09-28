-- Daily price-drop sweep at 04:00 UTC (07:00 Nairobi).
-- Edit pages notify buyers the moment a seller lowers a price; this catches
-- drops made any other way. It calls the notify-price-drop edge function with
-- the public anon key (the same key the website ships with): a sweep only
-- sends alerts for genuine drops, and each alert fires once.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('notify-price-drop-daily');
exception when others then
  null; -- not scheduled yet
end $$;

select cron.schedule(
  'notify-price-drop-daily',
  '0 4 * * *',
  $cron$
  select net.http_post(
    url := 'https://ktoodrjfytteppnpyhvi.supabase.co/functions/v1/notify-price-drop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0b29kcmpmeXR0ZXBwbnB5aHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDA0MDMsImV4cCI6MjA5Mjg3NjQwM30.4VknmxjOv9YjyvOzXHHfOIo3h2czfuT5NNu0-pXz-As'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
