-- ============================================================
-- PHOTOS IN CHAT
-- ============================================================
-- Buyers ask for more photos; sellers can now send them in the chat.
-- 1. messages.message_type allows 'image' (metadata.images = object paths).
-- 2. Private bucket chat-attachments, laid out {conversation_id}/{sender_id}/{file}.
--    Only the two people in the conversation (and admins) can read a
--    conversation's photos; you can only upload into your own folder of a
--    conversation you're part of.
-- ============================================================

-- 1. Allow the new message type (the original CHECK was unnamed, so find it).
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%message_type%'
  loop
    execute format('alter table public.messages drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'delivery_proposal', 'delivery_accepted', 'delivery_rejected', 'system'));

-- 2. Private bucket
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do update set public = false;

create or replace function public.is_conversation_participant(conv_text text, uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  conv uuid;
begin
  if uid is null then return false; end if;
  begin
    conv := conv_text::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.conversations c
    where c.id = conv and (c.buyer_id = uid or c.vendor_id = uid)
  );
end;
$$;

revoke all on function public.is_conversation_participant(text, uuid) from public, anon;
grant execute on function public.is_conversation_participant(text, uuid) to authenticated;

drop policy if exists "Participants upload chat photos" on storage.objects;
create policy "Participants upload chat photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_conversation_participant((storage.foldername(name))[1], auth.uid())
);

drop policy if exists "Participants read chat photos" on storage.objects;
create policy "Participants read chat photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and (
    public.is_conversation_participant((storage.foldername(name))[1], auth.uid())
    or public.has_role(auth.uid(), 'admin'::app_role)
  )
);
