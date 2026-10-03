-- A store's link now follows its name.
--
-- Until now the link was frozen once set, unless it had been derived from the
-- seller's personal name. A shop that started as "Mtaa Kicks" and became
-- "Habit & Home" kept sharing /store/mtaa-kicks.
--
-- From here on, renaming a shop moves its link too. The old link is kept in
-- store_link_aliases so every link already shared (Instagram bios, WhatsApp
-- statuses, printed cards) keeps opening the shop.

create table if not exists public.store_link_aliases (
  link       text primary key,
  vendor_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists store_link_aliases_vendor_idx on public.store_link_aliases(vendor_id);

alter table public.store_link_aliases enable row level security;

-- Links are public by nature. Only the trigger below writes to this table.
drop policy if exists "Anyone can read store link aliases" on public.store_link_aliases;
create policy "Anyone can read store link aliases"
  on public.store_link_aliases for select using (true);

grant select on public.store_link_aliases to anon, authenticated;

-- Slug for a store name, made unique against live links and other sellers'
-- old links so nobody can take over a link that is still being shared.
create or replace function public.make_store_link(p_name text, p_id uuid) returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  base_slug  text := coalesce(public.store_link_base(p_name), 'store');
  final_slug text := base_slug;
begin
  if exists (select 1 from public.profiles pr where pr.store_link = final_slug and pr.id <> p_id)
     or exists (select 1 from public.store_link_aliases a where a.link = final_slug and a.vendor_id <> p_id)
  then
    final_slug := base_slug || '-' || substr(p_id::text, 1, 6);
  end if;
  return final_slug;
end;
$fn$;

create or replace function public.auto_generate_store_link() returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  next_link text;
begin
  if new.store_link is null then
    new.store_link := public.make_store_link(coalesce(new.store_name, new.full_name, 'store'), new.id);
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.store_name is distinct from old.store_name
     and nullif(btrim(new.store_name), '') is not null
  then
    next_link := public.make_store_link(new.store_name, new.id);
    if next_link is distinct from old.store_link then
      insert into public.store_link_aliases (link, vendor_id)
      values (old.store_link, new.id)
      on conflict (link) do nothing;
      new.store_link := next_link;
      -- Renaming back to an earlier name: the live link is not also an alias.
      delete from public.store_link_aliases where link = next_link and vendor_id = new.id;
    end if;
  end if;

  return new;
end;
$fn$;

-- Bring existing shops in line with their current names. Row by row because
-- make_store_link checks the other rows. A link that is the plain name, or the
-- name plus the short id suffix used for clashes, is already right.
do $backfill$
declare
  r record;
  base text;
  next_link text;
begin
  for r in
    select id, store_name, store_link
    from public.profiles
    where nullif(btrim(store_name), '') is not null and store_link is not null
    order by created_at
  loop
    base := public.store_link_base(r.store_name);
    continue when r.store_link = base or r.store_link = base || '-' || substr(r.id::text, 1, 6);

    next_link := public.make_store_link(r.store_name, r.id);
    continue when next_link = r.store_link;

    insert into public.store_link_aliases (link, vendor_id) values (r.store_link, r.id)
      on conflict (link) do nothing;
    update public.profiles set store_link = next_link where id = r.id;
    delete from public.store_link_aliases where link = next_link and vendor_id = r.id;
  end loop;
end;
$backfill$;
