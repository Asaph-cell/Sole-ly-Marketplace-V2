-- ============================================================
-- MAKE DISPUTE EVIDENCE PRIVATE
-- ============================================================
-- The dispute-evidence bucket was public: anyone with a file URL could
-- view buyer/vendor evidence and tracking proof photos (addresses,
-- faces, packages), and any signed-in user could upload anywhere in it.
--
-- New uploads use:  {uploader_id}/{kind}/{ref_id}/{file}
--   kind = buyer    -> ref_id is the order id   (buyer dispute evidence)
--   kind = vendor   -> ref_id is the dispute id (vendor response evidence)
--   kind = tracking -> ref_id is the order id   (delivery proof photo)
--
-- Files uploaded before this migration keep working. Their layouts:
--   buyer/{order_id}/{file}
--   vendor/{dispute_id}/{file}
--   {order_id}-{timestamp}.{ext}          (tracking proof, bucket root)
--
-- Read access: admins, the uploader, and both parties (buyer and
-- vendor) of the order or dispute the file belongs to. The app shows
-- files through short-lived signed URLs.
-- ============================================================

update storage.buckets set public = false where id = 'dispute-evidence';

-- Is `uid` the buyer or vendor on the order / dispute this object belongs to?
create or replace function public.dispute_evidence_party(object_name text, uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[] := string_to_array(object_name, '/');
  kind text;
  ref_text text;
  ref uuid;
begin
  if uid is null then
    return false;
  end if;

  if array_length(parts, 1) >= 4 and parts[2] in ('buyer', 'vendor', 'tracking') then
    -- New layout: {uploader}/{kind}/{ref}/{file}
    kind := parts[2];
    ref_text := parts[3];
  elsif array_length(parts, 1) >= 3 and parts[1] in ('buyer', 'vendor') then
    -- Legacy: buyer/{order}/{file} or vendor/{dispute}/{file}
    kind := parts[1];
    ref_text := parts[2];
  elsif array_length(parts, 1) = 1 then
    -- Legacy tracking proof: {order_id}-{timestamp}.{ext}
    kind := 'tracking';
    ref_text := left(parts[1], 36);
  else
    return false;
  end if;

  begin
    ref := ref_text::uuid;
  exception when others then
    return false;
  end;

  if kind = 'vendor' then
    return exists (
      select 1 from public.disputes d
      where d.id = ref and (d.customer_id = uid or d.vendor_id = uid)
    );
  end if;

  return exists (
    select 1 from public.orders o
    where o.id = ref and (o.customer_id = uid or o.vendor_id = uid)
  );
end;
$$;

revoke all on function public.dispute_evidence_party(text, uuid) from public, anon;
grant execute on function public.dispute_evidence_party(text, uuid) to authenticated;

drop policy if exists "Users can upload dispute evidence" on storage.objects;
drop policy if exists "Public read access for dispute evidence" on storage.objects;
drop policy if exists "Users can delete own evidence" on storage.objects;

-- Upload only into your own folder, and only for an order/dispute you're part of.
create policy "Parties upload own dispute evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'dispute-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.dispute_evidence_party(name, auth.uid())
);

create policy "Parties and admins read dispute evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'dispute-evidence'
  and (
    public.has_role(auth.uid(), 'admin'::app_role)
    or (storage.foldername(name))[1] = auth.uid()::text
    or public.dispute_evidence_party(name, auth.uid())
  )
);

create policy "Uploaders delete own dispute evidence"
on storage.objects for delete to authenticated
using (
  bucket_id = 'dispute-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);
