-- Store links were being built from the vendor's personal name.
--
-- A profile row is created at signup, when store_name is still null, so the
-- ensure_store_link trigger fell back to full_name. When the vendor later set
-- their shop name the trigger's outer condition matched, but the inner
-- `IF NEW.store_link IS NULL` did not - the link already had a value - so it
-- was never regenerated. The link stayed locked to the person's name forever.
--
-- The result: "Jasmine Naturals" was published at /store/jazzmine-anita-8f03e2,
-- "Soapworks Bar" at /store/winnie-r-muthomi, and so on for 10 of 11 vendors.
-- That hides the shop's brand and, worse, puts each vendor's real personal
-- name in a public URL they never chose to publish.

-- Same slug rule as generate_store_link, exposed on its own so we can tell an
-- auto-derived link from one somebody deliberately chose.
create or replace function public.store_link_base(name text) returns text as $fn$
begin
    return nullif(
        trim(both '-' from lower(regexp_replace(coalesce(name, 'store'), '[^a-zA-Z0-9]+', '-', 'g'))),
        ''
    );
end;
$fn$ language plpgsql immutable;

-- Adopt the shop name once it exists, but never clobber a link the vendor
-- picked themselves: only rewrite when the current link is exactly what
-- full_name would have produced.
create or replace function public.auto_generate_store_link() returns trigger as $fn$
declare
    from_full_name text;
begin
    if new.store_link is null then
        new.store_link := generate_store_link(coalesce(new.store_name, new.full_name, 'store'), new.id);
        return new;
    end if;

    if tg_op = 'UPDATE'
       and new.store_name is distinct from old.store_name
       and new.store_name is not null
    then
        from_full_name := public.store_link_base(old.full_name);
        if from_full_name is not null and (
               old.store_link = from_full_name
            or old.store_link = from_full_name || '-' || substr(old.id::text, 1, 6)
        ) then
            new.store_link := generate_store_link(new.store_name, new.id);
        end if;
    end if;

    return new;
end;
$fn$ language plpgsql;

-- Backfill the vendors already affected. Row by row rather than one UPDATE:
-- generate_store_link resolves collisions by checking existing rows, and two
-- vendors here really do share the store name "Jasmine Naturals" - a set-based
-- update would compute the same slug for both and trip the unique constraint.
-- Updating store_link alone does not re-fire ensure_store_link, which is
-- declared UPDATE OF store_name.
do $backfill$
declare
    r record;
    from_full_name text;
begin
    for r in
        select id, full_name, store_name, store_link
        from public.profiles
        where store_name is not null
          and store_link is not null
        order by created_at
    loop
        from_full_name := public.store_link_base(r.full_name);

        if from_full_name is not null
           and (r.store_link = from_full_name
                or r.store_link = from_full_name || '-' || substr(r.id::text, 1, 6))
           and public.store_link_base(r.store_name) is distinct from from_full_name
        then
            update public.profiles
            set store_link = generate_store_link(r.store_name, r.id)
            where id = r.id;
        end if;
    end loop;
end;
$backfill$;
