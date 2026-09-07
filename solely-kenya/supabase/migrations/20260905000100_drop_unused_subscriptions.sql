-- Drop the vendor `subscriptions` table.
--
-- It was created with plan/price_ksh/product_limit columns for a paid-tier
-- model that was never built: zero rows, and nothing in the app or any edge
-- function ever read or wrote it. The vendor landing page already tells
-- vendors the opposite ("No subscriptions, no monthly costs") - commission
-- on sale is the only monetisation - so the table contradicts the stated
-- business model and is a trap for anyone reading the schema later.
--
-- Note this is NOT `push_subscriptions`, which is live and used by
-- usePushNotifications.ts for web push.

-- One RLS policy did reference the table: an UPDATE policy on products whose
-- WITH CHECK only let a vendor flip a draft to active if they held an active
-- subscription with room left in its product_limit. It reads like a paywall,
-- but it never enforced one. It sits alongside "Vendors can update own
-- products", which is also PERMISSIVE and carries no WITH CHECK at all, and
-- Postgres ORs permissive policies together - so the looser one always wins.
-- With zero subscription rows the gate would otherwise have blocked every
-- vendor from publishing anything; instead all 11 products are active, which
-- is the proof it was inert. Dropping it changes no behaviour.
drop policy if exists "Vendors can update own products with subscription check" on public.products;

drop table if exists public.subscriptions;
