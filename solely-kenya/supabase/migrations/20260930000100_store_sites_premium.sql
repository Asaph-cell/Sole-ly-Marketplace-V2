-- Seller websites, second pass: five more looks, many more controls, and
-- offers that also show on the main Solely marketplace.

-- ── More looks and hero styles ─────────────────────────────────────────────
alter table public.store_sites drop constraint if exists store_sites_theme_check;
alter table public.store_sites add constraint store_sites_theme_check
    check (theme in ('duka', 'atelier', 'street', 'mitumba', 'gadget', 'maison', 'pulse', 'bloom', 'atlas', 'souk'));

alter table public.store_sites drop constraint if exists store_sites_hero_style_check;
alter table public.store_sites add constraint store_sites_hero_style_check
    check (hero_style is null or hero_style in
        ('mosaic', 'portrait', 'type', 'line', 'stage', 'fullbleed', 'marquee', 'arch', 'collage', 'banner'));

-- ── Controls ───────────────────────────────────────────────────────────────
-- Overrides for what the look decides by default.
alter table public.store_sites add column if not exists card_style text
    check (card_style is null or card_style in
        ('tile', 'gallery', 'tag', 'peg', 'spec', 'editorial', 'neon', 'soft', 'plain', 'deal'));
alter table public.store_sites add column if not exists corners text
    check (corners is null or corners in ('sharp', 'soft', 'round'));
alter table public.store_sites add column if not exists grid_cols smallint
    check (grid_cols is null or grid_cols in (3, 4));

-- Type: sizes, boldness and colours. null means "the look's own".
alter table public.store_sites add column if not exists heading_scale text
    check (heading_scale is null or heading_scale in ('small', 'large', 'xlarge'));
alter table public.store_sites add column if not exists text_scale text
    check (text_scale is null or text_scale in ('small', 'large', 'xlarge'));
alter table public.store_sites add column if not exists heading_weight text
    check (heading_weight is null or heading_weight in ('regular', 'bold'));
alter table public.store_sites add column if not exists text_color text
    check (text_color is null or text_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.store_sites add column if not exists heading_color text
    check (heading_color is null or heading_color ~ '^#[0-9a-fA-F]{6}$');

-- Words at the top of the page, and the WhatsApp chat button.
alter table public.store_sites add column if not exists hero_title text
    check (hero_title is null or char_length(hero_title) <= 80);
alter table public.store_sites add column if not exists cta_text text
    check (cta_text is null or char_length(cta_text) <= 24);
alter table public.store_sites add column if not exists whatsapp_button boolean not null default true;

-- Extra photos for the gallery section, and the shop's own questions and answers.
alter table public.store_sites add column if not exists gallery jsonb not null default '[]'::jsonb
    check (jsonb_typeof(gallery) = 'array' and jsonb_array_length(gallery) <= 8);
alter table public.store_sites add column if not exists faqs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) <= 8);

-- ── Offers ─────────────────────────────────────────────────────────────────
-- A seller's current offer. It is a label with an end date, not a price
-- change: the seller honours it themselves. While the website is on and the
-- offer hasn't ended, Solely also shows it on the seller's products in the
-- marketplace and in the "Offers right now" row, so marketplace traffic
-- becomes traffic to the seller.
alter table public.store_sites add column if not exists offer_title text
    check (offer_title is null or char_length(offer_title) <= 40);
alter table public.store_sites add column if not exists offer_text text
    check (offer_text is null or char_length(offer_text) <= 140);
alter table public.store_sites add column if not exists offer_ends_at timestamptz;

create index if not exists store_sites_live_offers_idx
    on public.store_sites (offer_ends_at)
    where enabled and offer_title is not null;
