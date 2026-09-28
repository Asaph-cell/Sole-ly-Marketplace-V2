-- Rate limiting
--
-- One fixed-window counter per bucket. Edge functions call rate_limit_hit()
-- with the service role; client-facing tables get a BEFORE INSERT trigger so
-- a script hammering PostgREST with the anon key is capped too.
--
-- Buckets are free-form strings, e.g. "pin:<user>:<order>" or
-- "insert:messages:<uid-or-ip>". Rows are tiny and swept opportunistically.

create table if not exists public.rate_limit_hits (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  hits         integer     not null default 0
);

-- No policies: only security-definer functions and the service role touch it.
alter table public.rate_limit_hits enable row level security;

create or replace function public.rate_limit_hit(
  p_bucket         text,
  p_max            integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now    timestamptz := now();
  v_window interval    := make_interval(secs => p_window_seconds);
  v_row    public.rate_limit_hits;
begin
  insert into public.rate_limit_hits as r (bucket, window_start, hits)
  values (p_bucket, v_now, 1)
  on conflict (bucket) do update set
    hits         = case when r.window_start + v_window <= v_now then 1     else r.hits + 1     end,
    window_start = case when r.window_start + v_window <= v_now then v_now else r.window_start end
  returning * into v_row;

  -- ~1% of calls sweep expired rows so the table never needs a cron job.
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < v_now - interval '1 day';
  end if;

  allowed     := v_row.hits <= p_max;
  retry_after := greatest(0, ceil(extract(epoch from (v_row.window_start + v_window - v_now))))::integer;
  return next;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ─── Insert throttle for tables the browser writes to directly ─────────────
-- TG_ARGV[0] = max inserts, TG_ARGV[1] = window seconds.
-- Keyed by the signed-in user, falling back to the caller's IP for anon.
create or replace function public.enforce_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers json;
  v_ip      text;
  v_who     text;
  v_result  record;
begin
  -- Service-role writes (edge functions, cron) are trusted and never throttled.
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := split_part(coalesce(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-forwarded-for', 'unknown'), ',', 1);
  v_who := coalesce(auth.uid()::text, 'ip:' || trim(v_ip));

  select * into v_result
  from public.rate_limit_hit('insert:' || TG_TABLE_NAME || ':' || v_who, TG_ARGV[0]::integer, TG_ARGV[1]::integer);

  if not v_result.allowed then
    raise exception 'RATE_LIMITED: Too many requests. Please wait % seconds and try again.', v_result.retry_after
      using errcode = 'P0429';
  end if;

  return new;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('messages',          30, 60),    -- chat: 30 per minute
      ('dispute_messages',  20, 60),
      ('reviews',           10, 3600),
      ('vendor_ratings',    10, 3600),
      ('disputes',           5, 3600),
      ('listing_reports',   10, 3600),
      ('company_feedback',   5, 3600),
      ('products',          60, 3600),  -- vendors bulk-listing still fit comfortably
      ('payment_links',     20, 3600),
      ('product_views',    300, 3600),
      ('price_alerts',      30, 3600),
      ('wishlists',        120, 3600)
    ) as v(tbl, max_hits, window_secs)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists trg_rate_limit_insert on public.%I', t.tbl);
      execute format(
        'create trigger trg_rate_limit_insert before insert on public.%I
           for each row execute function public.enforce_insert_rate_limit(%L, %L)',
        t.tbl, t.max_hits::text, t.window_secs::text
      );
    end if;
  end loop;
end;
$$;
