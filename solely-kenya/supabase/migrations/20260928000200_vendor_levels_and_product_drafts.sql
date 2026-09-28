-- ============================================================
-- VENDOR LEVELS + ACCOUNT-SAVED PRODUCT DRAFTS
-- ============================================================
-- 1. Verification (Level 3) is now optional and only earns the
--    "Verified seller" badge. Nothing is gated on it, including
--    electronics.
-- 2. Sellers submit an ID / business registration photo into a
--    PRIVATE bucket; admins approve or reject via an RPC.
-- 3. Closes a hole: "Users can update own profile" had no column
--    limits, so any user could set their own kyc_status to
--    'approved' from the browser. A trigger now blocks non-admin
--    changes to the verification columns.
-- 4. product_drafts: one in-progress listing per seller, saved to
--    their account so it follows them across devices.
-- ============================================================


-- ── 1. Guard the verification columns ──────────────────────────
create or replace function public.guard_profile_kyc_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service role (edge functions, SQL console) and admins may change anything.
  if auth.uid() is null or public.has_role(auth.uid(), 'admin'::app_role) then
    return new;
  end if;

  -- The submit RPC flags its own transaction so a seller can move
  -- themselves to 'pending' through it, and only through it.
  if coalesce(current_setting('solely.kyc_submit', true), '') = 'on' then
    if new.kyc_status is distinct from 'pending' then
      raise exception 'Verification can only be submitted for review';
    end if;
    return new;
  end if;

  if new.kyc_status        is distinct from old.kyc_status
  or new.kyc_tier          is distinct from old.kyc_tier
  or new.kyc_documents     is distinct from old.kyc_documents
  or new.kyc_submitted_at  is distinct from old.kyc_submitted_at
  or new.kyc_reviewed_at   is distinct from old.kyc_reviewed_at
  or new.kyc_reject_reason is distinct from old.kyc_reject_reason then
    raise exception 'Verification details can only be changed by the Solely team';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_kyc_columns on public.profiles;
create trigger guard_profile_kyc_columns
  before update on public.profiles
  for each row execute function public.guard_profile_kyc_columns();


-- ── 2. Private bucket for verification documents ──────────────
insert into storage.buckets (id, name, public)
values ('vendor-verification', 'vendor-verification', false)
on conflict (id) do update set public = false;

-- Files live at {user_id}/{filename}; sellers only touch their own folder.
drop policy if exists "Sellers upload own verification docs" on storage.objects;
create policy "Sellers upload own verification docs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendor-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Sellers and admins read verification docs" on storage.objects;
create policy "Sellers and admins read verification docs"
on storage.objects for select to authenticated
using (
  bucket_id = 'vendor-verification'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role(auth.uid(), 'admin'::app_role)
  )
);


-- ── 3. Submit / review RPCs ────────────────────────────────────
create or replace function public.submit_vendor_verification(
  document_path text,
  document_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not public.has_role(auth.uid(), 'vendor'::app_role) then
    raise exception 'Only sellers can submit verification';
  end if;
  if document_type not in ('national_id', 'business_registration') then
    raise exception 'Unknown document type';
  end if;
  -- The document must be in the caller's own folder.
  if split_part(document_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid document';
  end if;

  select kyc_status into current_status from public.profiles where id = auth.uid();
  if current_status = 'approved' then
    raise exception 'You are already verified';
  end if;

  perform set_config('solely.kyc_submit', 'on', true);
  update public.profiles
     set kyc_status = 'pending',
         kyc_documents = jsonb_build_object('document_path', document_path, 'document_type', document_type),
         kyc_submitted_at = now(),
         kyc_reject_reason = null
   where id = auth.uid();
  perform set_config('solely.kyc_submit', 'off', true);
end;
$$;

revoke all on function public.submit_vendor_verification(text, text) from public, anon;
grant execute on function public.submit_vendor_verification(text, text) to authenticated;

create or replace function public.review_vendor_verification(
  vendor uuid,
  approve boolean,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'Only admins can review verification';
  end if;
  if not approve and coalesce(trim(reason), '') = '' then
    raise exception 'Give the seller a reason so they can fix it';
  end if;

  update public.profiles
     set kyc_status = case when approve then 'approved' else 'rejected' end,
         kyc_reviewed_at = now(),
         kyc_reject_reason = case when approve then null else trim(reason) end
   where id = vendor
     and kyc_status = 'pending';

  if not found then
    raise exception 'No pending verification for this seller';
  end if;
end;
$$;

revoke all on function public.review_vendor_verification(uuid, boolean, text) from public, anon;
grant execute on function public.review_vendor_verification(uuid, boolean, text) to authenticated;


-- ── 4. Account-saved product drafts ────────────────────────────
create table if not exists public.product_drafts (
  vendor_id  uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.product_drafts enable row level security;

drop policy if exists "Sellers manage own product draft" on public.product_drafts;
create policy "Sellers manage own product draft"
on public.product_drafts for all to authenticated
using (vendor_id = auth.uid())
with check (vendor_id = auth.uid());
