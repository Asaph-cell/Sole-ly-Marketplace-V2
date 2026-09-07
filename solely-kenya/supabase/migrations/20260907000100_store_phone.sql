-- An optional phone number a vendor chooses to publish on their storefront,
-- so a shopper can just call before buying.
--
-- Deliberately NOT reusing whatsapp_number. That one is entered for order
-- support and is only ever shown to a buyer who already has an order with
-- that vendor; publishing it to every anonymous visitor would expose it far
-- beyond what the vendor agreed to when they typed it in. This column is
-- separate, nullable and opt-in: a vendor who leaves it blank simply has no
-- call button, and nothing else changes.

alter table public.profiles add column if not exists store_phone text;

comment on column public.profiles.store_phone is
    'Optional public contact number shown on the vendor storefront. Opt-in; distinct from whatsapp_number, which is only shown to buyers with an existing order.';

-- The storefront reads through this view, so the column has to be added here
-- too or it stays invisible. Recreated rather than altered because Postgres
-- cannot add a column to an existing view in place.
drop view if exists public.public_vendor_profiles;

create view public.public_vendor_profiles as
select
    id,
    store_name,
    full_name,
    store_logo_url,
    store_description,
    store_link,
    vendor_city,
    vendor_county,
    kyc_status,
    whatsapp_number,
    store_phone,
    created_at
from public.profiles;

grant select on public.public_vendor_profiles to anon, authenticated;
