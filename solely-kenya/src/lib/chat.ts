import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateUUID } from "@/utils/uuid";

/** Signed-in user id, or the device's guest id for people chatting without an account. */
export const getChatUserId = async (): Promise<{ id: string; isGuest: boolean }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id) return { id: user.id, isGuest: false };
  let guest = (localStorage.getItem("guestId") || "").replace(/^guest:/, "");
  if (!guest) guest = generateUUID();
  localStorage.setItem("guestId", guest);
  return { id: guest, isGuest: true };
};

/**
 * Mark everything the other person sent in this conversation as read.
 * Uses the mark_conversation_read RPC (which also stamps read_at); falls back
 * to a plain update until that migration is applied.
 */
export const markConversationRead = async (conversationId: string, userId: string) => {
  const { error } = await (supabase as any).rpc("mark_conversation_read", { conv: conversationId });
  if (!error) return;
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_read", false);
};

// ── Photos ────────────────────────────────────────────────────────────────
// Private bucket, laid out {conversation}/{sender}/{file}; storage policies
// only let the two people in the conversation read it.
const CHAT_BUCKET = "chat-attachments";
export const MAX_CHAT_PHOTOS = 4;

export const uploadChatPhotos = async (conversationId: string, userId: string, files: File[]) => {
  const paths: string[] = [];
  for (const file of files) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${conversationId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, file, { contentType: file.type || "image/jpeg" });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
};

/** Short-lived signed URLs for chat photo paths, in the same order ("" until loaded). */
export const useSignedChatImages = (paths: string[] | null | undefined) => {
  const key = (paths ?? []).join("|");
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const list = paths ?? [];
    if (!list.length) { setUrls([]); return; }
    let cancelled = false;
    supabase.storage.from(CHAT_BUCKET).createSignedUrls(list, 60 * 60).then(({ data }) => {
      if (!cancelled) setUrls(list.map((_, i) => data?.[i]?.signedUrl ?? ""));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
};

/** Conversation starters, so chats go beyond the delivery fee. */
export const QUICK_REPLIES = {
  buyer: [
    "Is this still available?",
    "Can I see more photos?",
    "Which sizes do you have?",
    "Where are you located?",
    "How soon can you deliver?",
  ],
  vendor: [
    "Yes, it's available",
    "I'll send more photos now",
    "I can deliver today",
    "Which size do you need?",
    "Thanks for your order!",
  ],
};
