-- "Was" price for reductions. The card shows it struck through next to the
-- real price. It is display only: checkout always charges price_ksh.

alter table public.products add column if not exists original_price integer;

-- Only keep a was-price that is genuinely higher than the selling price, so a
-- vendor cannot fake a discount and a later price rise cleans itself up.
create or replace function public.products_clean_original_price()
returns trigger
language plpgsql
as $$
begin
  if new.original_price is not null and new.original_price <= new.price_ksh then
    new.original_price := null;
  end if;
  return new;
end;
$$;

drop trigger if exists products_clean_original_price on public.products;
create trigger products_clean_original_price
  before insert or update on public.products
  for each row execute function public.products_clean_original_price();

-- search_products returns a table, so adding a column means recreating it.
drop function if exists public.search_products(
  text, text, text, text, text, numeric, numeric, text, integer, integer, text[], text[]
);

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
  original_price integer,
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
    r.original_price,
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

grant execute on function public.search_products(
  text, text, text, text, text, numeric, numeric, text, integer, integer, text[], text[]
) to anon, authenticated;
