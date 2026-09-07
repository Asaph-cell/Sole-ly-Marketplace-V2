-- ============================================================
-- LISTING REPORTS (infringement / counterfeit intake)
-- ============================================================
-- Enforcement already existed: admin-action can pause_product,
-- delete_product, penalize_vendor and revoke_vendor, and every one of
-- those writes to admin_activity_log with a reason. Escrow means funds
-- can still be withheld from a vendor after a sale.
--
-- What did not exist was any way to LEARN about an infringing listing.
-- The only reporting function in the codebase, report-stolen-item, is
-- vendor-only and covers a buyer absconding after PIN entry. A brand
-- owner, their representative, or a buyer who spots a fake had no route
-- to us at all.
--
-- That gap matters commercially as well as legally: a payment processor
-- underwriting a marketplace asks how sub-merchant listings are policed,
-- and "we remove infringing listings promptly" is only a true statement
-- if somebody can actually reach you.
--
-- Reports are deliberately accepted from anonymous submitters. A rights
-- holder's lawyer will not create a shopping account to file a notice.
-- ============================================================

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- ── What is being reported ──────────────────────────────
  -- product_id is nullable and ON DELETE SET NULL on purpose: the whole
  -- point of a report is that the listing may get taken down, and the
  -- report must outlive it as the record of why. listing_url and
  -- product_short_code preserve what was reported after that happens.
  report_type        text not null check (report_type in
                       ('counterfeit','copyright','trademark','publicity','stolen','other')),
  product_id         uuid references public.products(id) on delete set null,
  product_short_code text,
  listing_url        text,

  -- ── Who is reporting (no account required) ──────────────
  reporter_name         text not null,
  reporter_email        text not null,
  reporter_organization text,
  reporter_role         text not null check (reporter_role in
                          ('rights_holder','representative','buyer','other')),

  -- ── The claim ───────────────────────────────────────────
  description  text not null,
  evidence_url text,
  -- Standard good-faith and accuracy declarations. Kept as columns rather
  -- than prose so the admin queue can show that they were made.
  good_faith            boolean not null default false,
  accuracy_declaration  boolean not null default false,

  -- ── Handling ────────────────────────────────────────────
  status      text not null default 'new'
                check (status in ('new','reviewing','actioned','rejected')),
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists listing_reports_status_idx
  on public.listing_reports (status, created_at desc);

create index if not exists listing_reports_product_idx
  on public.listing_reports (product_id);

alter table public.listing_reports enable row level security;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
-- Anyone may file a report, including logged-out visitors. The WITH CHECK
-- pins every handling column to its initial state so a submitter cannot
-- file a report that is already marked actioned, attribute a review to an
-- admin, or write admin_notes.

drop policy if exists "Anyone can file a listing report" on public.listing_reports;
create policy "Anyone can file a listing report"
  on public.listing_reports for insert
  to anon, authenticated
  with check (
    status = 'new'
    and reviewed_by is null
    and reviewed_at is null
    and admin_notes is null
  );

-- Reports contain a third party's name, email and allegations about a
-- named vendor, so they are admin-only to read. Deliberately no policy
-- lets a reporter read their own report back: with anonymous submission
-- there is no identity to match on, and matching on the email column
-- alone would let anyone enumerate reports by guessing addresses.
drop policy if exists "Admins can view listing reports" on public.listing_reports;
create policy "Admins can view listing reports"
  on public.listing_reports for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update listing reports" on public.listing_reports;
create policy "Admins can update listing reports"
  on public.listing_reports for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- No delete policy for anyone. Reports are the audit trail that shows a
-- complaint was received and what was done about it; that record is the
-- thing an underwriter or a rights holder's lawyer asks to see.

grant select, insert, update on public.listing_reports to authenticated;
grant insert on public.listing_reports to anon;
