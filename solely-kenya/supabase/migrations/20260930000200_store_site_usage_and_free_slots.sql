-- Seller websites: who gets them free, and how much each one is used.
--
-- The first N sellers (platform_settings.website_free_slots, default 10) to
-- switch their website on get a "founding" slot and keep it free. Once the
-- slots are gone, further sellers can still build and preview their website
-- but cannot switch it on; they can join a waitlist. The limit is enforced
-- here, in a trigger, so two sellers switching on at the same moment cannot
-- both take the last slot and a client cannot grant itself one.

-- ── Free slots ─────────────────────────────────────────────────────────────
insert into public.platform_settings (key, value, description) values
    ('website_free_slots', '10', 'How many sellers can switch on their own website for free (founding sellers). Once taken, further sellers must wait for paid plans.')
on conflict (key) do nothing;

alter table public.store_sites add column if not exists founding boolean not null default false;
alter table public.store_sites add column if not exists first_enabled_at timestamptz;

-- Sellers who already have their website on before this migration keep their
-- place, oldest first, up to the limit.
with ranked as (
    select vendor_id, row_number() over (order by created_at) as n
    from public.store_sites
    where enabled and not founding
)
update public.store_sites s
set founding = true, first_enabled_at = coalesce(s.first_enabled_at, s.updated_at)
from ranked r
where s.vendor_id = r.vendor_id
  and r.n <= coalesce((select (value #>> '{}')::int from public.platform_settings where key = 'website_free_slots'), 10);

create or replace function public.store_sites_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit   integer;
    v_taken   integer;
    v_trusted boolean := coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin');
begin
    -- A seller can never write the slot columns themselves.
    if not v_trusted then
        if tg_op = 'INSERT' then
            new.founding := false;
            new.first_enabled_at := null;
        else
            new.founding := old.founding;
            new.first_enabled_at := old.first_enabled_at;
        end if;
    end if;

    -- Switching on without a slot yet: take one if any are left.
    if new.enabled and (tg_op = 'INSERT' or not old.enabled) and not new.founding then
        perform pg_advisory_xact_lock(hashtext('store_sites_free_slots'));

        select coalesce((value #>> '{}')::int, 10) into v_limit
        from public.platform_settings where key = 'website_free_slots';
        v_limit := coalesce(v_limit, 10);

        select count(*) into v_taken from public.store_sites where founding;

        if v_taken >= v_limit then
            raise exception 'WEBSITE_FREE_SPOTS_FULL: All % free website spots are taken.', v_limit
                using errcode = 'P0402';
        end if;

        new.founding := true;
        new.first_enabled_at := coalesce(new.first_enabled_at, now());
    end if;

    return new;
end;
$$;

drop trigger if exists store_sites_guard_trg on public.store_sites;
create trigger store_sites_guard_trg
    before insert or update on public.store_sites
    for each row execute function public.store_sites_guard();

-- How many free spots there are and whether this seller holds one.
create or replace function public.website_free_slots()
returns json
language sql
stable
security definer
set search_path = public
as $$
    select json_build_object(
        'limit', coalesce((select (value #>> '{}')::int from public.platform_settings where key = 'website_free_slots'), 10),
        'taken', (select count(*) from public.store_sites where founding),
        'mine',  coalesce((select founding from public.store_sites where vendor_id = auth.uid()), false)
    );
$$;

revoke all on function public.website_free_slots() from public, anon;
grant execute on function public.website_free_slots() to authenticated;

-- ── Waitlist for when the free spots are gone ──────────────────────────────
create table if not exists public.store_site_waitlist (
    vendor_id  uuid primary key references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.store_site_waitlist enable row level security;

drop policy if exists "Sellers join the website waitlist" on public.store_site_waitlist;
create policy "Sellers join the website waitlist" on public.store_site_waitlist
    for insert to authenticated
    with check (vendor_id = auth.uid() and public.has_role(auth.uid(), 'vendor'::app_role));

drop policy if exists "Sellers see their own waitlist spot" on public.store_site_waitlist;
create policy "Sellers see their own waitlist spot" on public.store_site_waitlist
    for select to authenticated
    using (vendor_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

grant select, insert on public.store_site_waitlist to authenticated;

-- ── Usage events ───────────────────────────────────────────────────────────
-- What visitors do on a seller's website. Product views already land in
-- product_views (source 'own_site'); these cover the rest.
create table if not exists public.store_site_events (
    id         bigint generated always as identity primary key,
    vendor_id  uuid not null references public.profiles(id) on delete cascade,
    kind       text not null check (kind in ('visit', 'buy_click', 'whatsapp_click')),
    -- Opaque random id kept in the visitor's browser; not an account.
    visitor_id text,
    created_at timestamptz not null default now()
);

create index if not exists store_site_events_vendor_idx on public.store_site_events (vendor_id, created_at desc);

alter table public.store_site_events enable row level security;

-- Anyone can log an event, but only for a website that is switched on.
drop policy if exists "Log events for live websites" on public.store_site_events;
create policy "Log events for live websites" on public.store_site_events
    for insert to anon, authenticated
    with check (exists (select 1 from public.store_sites s where s.vendor_id = store_site_events.vendor_id and s.enabled));

drop policy if exists "Sellers read their own website events" on public.store_site_events;
create policy "Sellers read their own website events" on public.store_site_events
    for select to authenticated
    using (vendor_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

grant insert on public.store_site_events to anon, authenticated;
grant select on public.store_site_events to authenticated;

-- A script can't flood the log: 300 events an hour per visitor.
drop trigger if exists trg_rate_limit_insert on public.store_site_events;
create trigger trg_rate_limit_insert
    before insert on public.store_site_events
    for each row execute function public.enforce_insert_rate_limit('300', '3600');

-- ── Admin: usage of every website ──────────────────────────────────────────
create or replace function public.admin_store_site_usage()
returns table (
    vendor_id           uuid,
    store_name          text,
    store_link          text,
    enabled             boolean,
    founding            boolean,
    first_enabled_at    timestamptz,
    theme               text,
    offer_active        boolean,
    visits_7d           integer,
    visits_30d          integer,
    buy_clicks_30d      integer,
    whatsapp_clicks_30d integer,
    product_views_30d   integer,
    waitlisted          boolean,
    updated_at          timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.has_role(auth.uid(), 'admin'::app_role) then
        raise exception 'Not allowed' using errcode = '42501';
    end if;

    return query
    select
        s.vendor_id,
        coalesce(p.store_name, p.full_name),
        p.store_link,
        s.enabled,
        s.founding,
        s.first_enabled_at,
        s.theme,
        (s.offer_title is not null and s.offer_ends_at > now()),
        (select count(*)::int from public.store_site_events e where e.vendor_id = s.vendor_id and e.kind = 'visit' and e.created_at > now() - interval '7 days'),
        (select count(*)::int from public.store_site_events e where e.vendor_id = s.vendor_id and e.kind = 'visit' and e.created_at > now() - interval '30 days'),
        (select count(*)::int from public.store_site_events e where e.vendor_id = s.vendor_id and e.kind = 'buy_click' and e.created_at > now() - interval '30 days'),
        (select count(*)::int from public.store_site_events e where e.vendor_id = s.vendor_id and e.kind = 'whatsapp_click' and e.created_at > now() - interval '30 days'),
        (select count(*)::int from public.product_views v join public.products pr on pr.id = v.product_id
            where pr.vendor_id = s.vendor_id and v.source = 'own_site' and v.viewed_at > now() - interval '30 days'),
        exists (select 1 from public.store_site_waitlist w where w.vendor_id = s.vendor_id),
        s.updated_at
    from public.store_sites s
    join public.profiles p on p.id = s.vendor_id
    order by s.enabled desc, s.first_enabled_at nulls last, s.created_at;
end;
$$;

revoke all on function public.admin_store_site_usage() from public, anon;
grant execute on function public.admin_store_site_usage() to authenticated;

-- Waitlisted sellers who haven't made a website row yet, for the admin count.
create or replace function public.admin_store_site_waitlist_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select case when public.has_role(auth.uid(), 'admin'::app_role)
        then (select count(*)::int from public.store_site_waitlist)
        else 0 end;
$$;

revoke all on function public.admin_store_site_waitlist_count() from public, anon;
grant execute on function public.admin_store_site_waitlist_count() to authenticated;
