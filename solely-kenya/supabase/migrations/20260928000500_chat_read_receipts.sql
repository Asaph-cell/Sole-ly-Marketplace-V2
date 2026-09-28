-- ============================================================
-- CHAT READ RECEIPTS
-- ============================================================
-- 1. read_at: when the recipient saw the message, so the sender can see
--    "Seen 2:14 pm" instead of just a flag.
-- 2. Closes a hole: "Participants can update messages" let either side of
--    a conversation UPDATE any column of any message in it, i.e. rewrite the
--    other person's text or an agreed delivery-fee message. Marking as read
--    now goes through mark_conversation_read(), which can only flip
--    is_read/read_at on messages the caller received.
-- ============================================================

alter table public.messages add column if not exists read_at timestamptz;

-- Backfill: already-read messages get their send time as a best guess.
update public.messages set read_at = created_at where is_read and read_at is null;

drop policy if exists "Participants can update messages" on public.messages;

create or replace function public.mark_conversation_read(conv uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = conv and (c.buyer_id = auth.uid() or c.vendor_id = auth.uid())
  ) then
    return 0;
  end if;

  update public.messages
     set is_read = true, read_at = now()
   where conversation_id = conv
     and sender_id <> auth.uid()
     and is_read = false;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Make sure read-status changes reach the sender in realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
