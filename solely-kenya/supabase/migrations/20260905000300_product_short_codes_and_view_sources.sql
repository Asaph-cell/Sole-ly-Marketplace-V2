-- Short share links, and enough view detail for vendors to learn something.
--
-- 1. products.short_code
--    The share modal hands vendors /buy/<uuid> - 36 characters of hex that
--    looks broken in an Instagram bio and cannot be read off a poster.
--    payment_links already solved this with short_code (/pay/TQ94ASH resolves
--    in SecureInvoice), but the product share path never got the same
--    treatment. Same idea, applied to products.
--
-- 2. product_views.source / visitor_id
--    Views were (product_id, viewed_at) only, so a vendor could see a number
--    go up and nothing else - not whether it came from their own shared link
--    or from browsing, and not whether ten views were ten people or one
--    person refreshing. Both are the difference between a number and a
--    decision.

-- ── Short codes ────────────────────────────────────────────────────────
alter table public.products add column if not exists short_code text;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'products_short_code_key'
    ) then
        alter table public.products add constraint products_short_code_key unique (short_code);
    end if;
end;
$$;

-- Ambiguous glyphs are left out (0/O, 1/I/L) because these get read aloud,
-- typed from a poster and printed on packaging.
create or replace function public.generate_product_short_code() returns text as $fn$
declare
    alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    code text;
    i int;
begin
    loop
        code := '';
        for i in 1..7 loop
            code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
        end loop;
        exit when not exists (select 1 from public.products where short_code = code);
    end loop;
    return code;
end;
$fn$ language plpgsql;

create or replace function public.set_product_short_code() returns trigger as $fn$
begin
    if new.short_code is null then
        new.short_code := public.generate_product_short_code();
    end if;
    return new;
end;
$fn$ language plpgsql;

drop trigger if exists ensure_product_short_code on public.products;
create trigger ensure_product_short_code
    before insert on public.products
    for each row
    execute function public.set_product_short_code();

-- Backfill row by row: generate_product_short_code checks existing rows for
-- collisions, and a set-based update would not see codes assigned to other
-- rows in the same statement.
do $backfill$
declare
    r record;
begin
    for r in select id from public.products where short_code is null loop
        update public.products
        set short_code = public.generate_product_short_code()
        where id = r.id;
    end loop;
end;
$backfill$;

-- ── View detail ────────────────────────────────────────────────────────
-- source: where the view came from ('buy_link', 'product_page', 'storefront').
-- visitor_id: an opaque random id the browser keeps in localStorage. Not an
-- account, not derived from IP or anything personal - it exists only so
-- repeat refreshes by one person can be told apart from ten people.
alter table public.product_views add column if not exists source text;
alter table public.product_views add column if not exists visitor_id text;

create index if not exists product_views_product_viewed_idx
    on public.product_views (product_id, viewed_at desc);
