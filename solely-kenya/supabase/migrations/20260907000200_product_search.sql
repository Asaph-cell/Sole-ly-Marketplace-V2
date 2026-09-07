-- ============================================================
-- SERVER-SIDE PRODUCT SEARCH (pg_trgm + tsvector)
-- ============================================================
-- Before this migration, /shop fetched EVERY active product with
-- `select("*")` (no limit, image arrays included), fetched EVERY row
-- of `reviews` to aggregate ratings client-side, and then filtered in
-- JavaScript with `name/brand/description.includes(query)`.
--
-- Three problems that fixes:
--   1. Payload. Two unbounded table scans shipped to a phone on every
--      Shop mount. That is the single largest data cost in the app and
--      it grows linearly with the catalogue.
--   2. Search quality. Substring matching has no typo tolerance
--      ("addidas"), no stemming ("shoes" vs "shoe"), no ranking, and no
--      partial credit — "red running shoes size 42" matched nothing
--      because no single field contained that literal string.
--   3. Ranking. Results came back in whatever order Postgres returned
--      them, then were sorted by price/date. Relevance did not exist.
--
-- This migration moves all of it into Postgres:
--   * a STORED generated tsvector with per-field weights (A..D)
--   * GIN indexes on the tsvector and on trigrams of name/brand
--   * search_products() — filter + rank + paginate + rating aggregate
--     in one round trip, returning total_count via a window function
--   * product_brands() — the brand facet, without shipping the catalogue
--
-- Ranking combines three signals, so a query degrades gracefully instead
-- of falling off a cliff:
--   * full-text rank over an OR'd prefix query (partial credit for
--     matching some words — this is what rescues "red running shoes 42")
--   * trigram similarity on name/brand (typo tolerance)
--   * an optional interest boost, so the existing "For You" sort keeps
--     working once its signals move server-side
--
-- SECURITY INVOKER (the default) is deliberate: the existing
-- "Everyone can view active products" RLS policy still applies, so anon
-- callers can only ever reach active rows.
-- ============================================================

-- Supabase installs extensions into the `extensions` schema; a plain
-- `create extension` in a migration lands in `public`. Pinning the path
-- here means `gin_trgm_ops`, `similarity()` and the `%` operator resolve
-- at DDL time whichever of the two pg_trgm already lives in. The
-- functions below repeat it for their own runtime resolution.
set local search_path = public, extensions;

create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────────────────────
-- 0. Schema drift guard
-- ─────────────────────────────────────────────────────────────
-- products.free_delivery exists in the live database and in
-- src/integrations/supabase/types.ts, but no migration ever created it
-- (it was added through the dashboard). search_products() below returns
-- it, so without this line a fresh `supabase db reset` would fail to
-- create the function. No-op against the live database.

alter table public.products
  add column if not exists free_delivery boolean;

-- ─────────────────────────────────────────────────────────────
-- 1. Weighted search vector
-- ─────────────────────────────────────────────────────────────
-- Weights: A = name/brand (what people actually type), B = taxonomy,
-- C = concrete attributes they filter on out loud ("black", "size 42"),
-- D = description prose.
--
-- 'english' gives stemming (shoes -> shoe, running -> run). Every
-- function used here is IMMUTABLE, which a STORED generated column
-- requires. jsonb spec columns are deliberately left out — casting
-- jsonb to text would index the keys and punctuation as search terms.

alter table public.products
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')),        'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(subcategory, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(category, '')),    'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(key_features, '{}'::text[]), ' ')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce(colors,       '{}'::text[]), ' ')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce(sizes,        '{}'::text[]), ' ')), 'C') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) stored;

-- ─────────────────────────────────────────────────────────────
-- 2. Indexes
-- ─────────────────────────────────────────────────────────────
create index if not exists products_search_vector_idx
  on public.products using gin (search_vector);

-- Trigram indexes back the `%` similarity operator (typo tolerance).
create index if not exists products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops);

create index if not exists products_brand_trgm_idx
  on public.products using gin (brand gin_trgm_ops);

-- Partial index: every storefront query filters on active.
create index if not exists products_active_idx
  on public.products (created_at desc) where status = 'active';

-- The rating aggregate below joins per product.
create index if not exists reviews_product_id_idx
  on public.reviews (product_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Query builder
-- ─────────────────────────────────────────────────────────────
-- Strips everything that is not alphanumeric, then OR-joins the words
-- with a :* prefix match. Two reasons for OR rather than AND:
--   * AND (websearch_to_tsquery / plainto_tsquery) requires every term
--     to be present, which is exactly why long natural queries return
--     nothing today.
--   * With OR, ts_rank still scores documents matching more terms
--     higher, so the best result floats to the top and the near-misses
--     remain visible instead of vanishing.
--
-- Sanitising first means user input can never be interpreted as
-- tsquery syntax, so to_tsquery cannot raise on input like "a & (".

create or replace function public.build_product_tsquery(p_search text)
returns tsquery
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v_words text[];
  v_joined text;
begin
  if p_search is null or btrim(p_search) = '' then
    return null;
  end if;

  -- Alias the unnest result as t(w) rather than bare `w`: with
  -- `unnest(...) as w` the table alias and its single column share a
  -- name, which makes a bare `w` reference ambiguous.
  select array_agg(t.w || ':*')
    into v_words
  from unnest(
    regexp_split_to_array(
      btrim(lower(regexp_replace(p_search, '[^a-zA-Z0-9]+', ' ', 'g'))),
      '\s+'
    )
  ) as t(w)
  where t.w <> '';

  if v_words is null or cardinality(v_words) = 0 then
    return null;
  end if;

  v_joined := array_to_string(v_words, ' | ');
  return to_tsquery('english', v_joined);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. search_products
-- ─────────────────────────────────────────────────────────────
-- One call returns the page, the rating aggregate, and the unfiltered
-- total (via count(*) over ()) so the UI can render "20 / 143 results"
-- and drive Load More without a second query.
--
-- p_boost_categories / p_boost_brands carry the client's localStorage
-- interest profile (most-interested first). Earlier position = larger
-- boost. Passing empty arrays disables the boost entirely.

create or replace function public.search_products(
  p_search            text    default null,
  p_category          text    default null,
  p_subcategory       text    default null,
  p_brand             text    default null,
  p_condition         text    default null,
  p_min_price         numeric default null,
  p_max_price         numeric default null,
  p_sort              text    default 'smart',
  p_limit             integer default 20,
  p_offset            integer default 0,
  p_boost_categories  text[]  default '{}'::text[],
  p_boost_brands      text[]  default '{}'::text[]
)
returns table (
  id             uuid,
  name           text,
  price_ksh      integer,
  images         text[],
  brand          text,
  description    text,
  created_at     timestamptz,
  condition      text,
  video_url      text,
  free_delivery  boolean,
  category       text,
  subcategory    text,
  vendor_id      uuid,
  short_code     text,
  stock          integer,
  sizes          text[],
  colors         text[],
  average_rating numeric,
  review_count   bigint,
  relevance      real,
  total_count    bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_query tsquery := public.build_product_tsquery(p_search);
  v_term  text    := nullif(btrim(coalesce(p_search, '')), '');
begin
  return query
  with matched as (
    select
      p.*,
      -- Full-text relevance. 0 when the caller is browsing, not searching.
      case
        when v_query is null then 0::real
        else ts_rank(p.search_vector, v_query)
      end as ts_score,
      -- Typo tolerance: best trigram similarity across name and brand.
      case
        when v_term is null then 0::real
        else greatest(
          similarity(p.name, v_term),
          similarity(coalesce(p.brand, ''), v_term)
        )
      end as trgm_score,
      -- Interest boost, decaying by position in the caller's profile.
      (
        coalesce(
          case
            when array_position(p_boost_categories, lower(coalesce(p.category, ''))) is not null
            then (10 - least(array_position(p_boost_categories, lower(coalesce(p.category, ''))), 9))
          end, 0)
        +
        coalesce(
          case
            when array_position(p_boost_brands, lower(coalesce(p.brand, ''))) is not null
            then (10 - least(array_position(p_boost_brands, lower(coalesce(p.brand, ''))), 9))
          end, 0)
      )::real as interest_score
    from public.products p
    where p.status = 'active'
      and (
        v_query is null
        or p.search_vector @@ v_query
        or p.name % v_term
        or coalesce(p.brand, '') % v_term
      )
      and (p_category    is null or lower(p.category)    = lower(p_category))
      and (p_subcategory is null or lower(p.subcategory) = lower(p_subcategory))
      and (p_brand       is null or lower(p.brand)       = lower(p_brand))
      and (p_condition   is null or p.condition          = p_condition)
      and (p_min_price   is null or p.price_ksh         >= p_min_price)
      and (p_max_price   is null or p.price_ksh         <= p_max_price)
  ),
  rated as (
    select
      m.*,
      rv.avg_rating,
      rv.cnt,
      -- Composite score. Text rank is scaled up because ts_rank returns
      -- small values (typically < 0.1) next to similarity's 0..1 range.
      (m.ts_score * 40 + m.trgm_score * 8 + m.interest_score) as score
    from matched m
    left join lateral (
      select avg(r.rating)::numeric as avg_rating, count(*)::bigint as cnt
      from public.reviews r
      where r.product_id = m.id
    ) rv on true
  )
  select
    r.id,
    r.name,
    r.price_ksh,
    r.images,
    r.brand,
    r.description,
    r.created_at,
    r.condition,
    r.video_url,
    r.free_delivery,
    r.category,
    r.subcategory,
    r.vendor_id,
    r.short_code,
    r.stock,
    r.sizes,
    r.colors,
    r.avg_rating as average_rating,
    coalesce(r.cnt, 0) as review_count,
    r.score::real as relevance,
    count(*) over () as total_count
  from rated r
  order by
    -- A search term always ranks by relevance first; explicit sorts
    -- then break ties. Browsing (no term) skips straight to the sort.
    case when v_term is not null and p_sort in ('smart', 'relevance')
         then r.score end desc nulls last,
    case when p_sort = 'price-low'  then r.price_ksh end asc  nulls last,
    case when p_sort = 'price-high' then r.price_ksh end desc nulls last,
    case when p_sort = 'trusted'    then coalesce(r.avg_rating, 0) end desc nulls last,
    case when p_sort = 'newest'     then r.created_at end desc nulls last,
    case when p_sort = 'smart' and v_term is null then r.score end desc nulls last,
    r.created_at desc,
    r.id
  limit  greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. product_brands — the Brand facet
-- ─────────────────────────────────────────────────────────────
-- PostgREST has no DISTINCT, which is why the client was deriving the
-- brand list from a full catalogue fetch. This returns just the labels.

create or replace function public.product_brands(
  p_category text default null
)
returns table (brand text, product_count bigint)
language sql
stable
set search_path = public, extensions
as $$
  select p.brand, count(*)::bigint as product_count
  from public.products p
  where p.status = 'active'
    and p.brand is not null
    and btrim(p.brand) <> ''
    and (p_category is null or lower(p.category) = lower(p_category))
  group by p.brand
  order by count(*) desc, p.brand asc;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Grants
-- ─────────────────────────────────────────────────────────────
-- Shop is browsable logged-out, so anon needs execute. RLS still gates
-- the rows because these are SECURITY INVOKER.

grant execute on function public.build_product_tsquery(text)              to anon, authenticated;
grant execute on function public.product_brands(text)                     to anon, authenticated;
grant execute on function public.search_products(
  text, text, text, text, text, numeric, numeric, text, integer, integer, text[], text[]
) to anon, authenticated;
