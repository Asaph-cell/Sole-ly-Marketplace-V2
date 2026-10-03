-- Seller websites: a seller can switch their store page
-- (solelymarketplace.com/store/<store_link>) into their own designed website:
-- a look, colours, hero style, which sections show and in what order, their
-- own about text and Instagram / TikTok links. Same products, orders and
-- checkout as the rest of Solely; this table only holds how the page looks.

create table if not exists public.store_sites (
    vendor_id uuid primary key references public.profiles(id) on delete cascade,
    -- Off: the store page shows the standard Solely layout.
    enabled boolean not null default false,
    theme text not null default 'duka'
        check (theme in ('duka', 'atelier', 'street', 'mitumba', 'gadget')),
    palette smallint not null default 0 check (palette between 0 and 2),
    accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
    hero_style text check (hero_style is null or hero_style in ('mosaic', 'portrait', 'type', 'line', 'stage')),
    -- [{"id": "featured", "visible": true}, ...] in display order.
    sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
    tagline text check (tagline is null or char_length(tagline) <= 120),
    about text check (about is null or char_length(about) <= 1500),
    announcement text check (announcement is null or char_length(announcement) <= 100),
    banner_url text,
    instagram text check (instagram is null or char_length(instagram) <= 200),
    tiktok text check (tiktok is null or char_length(tiktok) <= 200),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.store_sites is
    'How a seller''s store page looks when they switch on their own website.';

create or replace function public.touch_store_sites()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists store_sites_touch on public.store_sites;
create trigger store_sites_touch
    before update on public.store_sites
    for each row execute function public.touch_store_sites();

alter table public.store_sites enable row level security;

-- Anyone can read a switched-on website; sellers can always read their own
-- (to edit it before switching it on).
drop policy if exists "Anyone can view live store sites" on public.store_sites;
create policy "Anyone can view live store sites" on public.store_sites
    for select to anon, authenticated
    using (enabled or vendor_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Sellers create their own site" on public.store_sites;
create policy "Sellers create their own site" on public.store_sites
    for insert to authenticated
    with check (vendor_id = auth.uid() and public.has_role(auth.uid(), 'vendor'::app_role));

drop policy if exists "Sellers edit their own site" on public.store_sites;
create policy "Sellers edit their own site" on public.store_sites
    for update to authenticated
    using (vendor_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role))
    with check (vendor_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

grant select on public.store_sites to anon, authenticated;
grant insert, update on public.store_sites to authenticated;
