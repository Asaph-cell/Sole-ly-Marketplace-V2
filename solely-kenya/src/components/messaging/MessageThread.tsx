import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ImagePlus, Loader2, SendHorizontal, Store, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { getChatUserId, markConversationRead, QUICK_REPLIES, uploadChatPhotos, MAX_CHAT_PHOTOS } from "@/lib/chat";
import { compressImages } from "@/lib/compressImage";
import { useIsOnline, useTyping } from "@/hooks/usePresence";
import { ChatMessages, ChatMessage } from "@/components/messaging/ChatMessages";
import { DeliveryFeeBar, Agreement } from "@/components/messaging/DeliveryFeeBar";

interface MessageThreadProps {
  conversationId: string;
  /** Shown on phones, where the thread replaces the conversation list. */
  onBack?: () => void;
}

type Conversation = { id: string; buyer_id: string | null; vendor_id: string; delivery_agreement_id: string | null };
type OtherUser = { id: string; name: string; storeLink?: string | null; isStore: boolean };

export const MessageThread = ({ conversationId, onBack }: MessageThreadProps) => {
  const [me, setMe] = useState<{ id: string; isGuest: boolean } | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [other, setOther] = useState<OtherUser | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Photos picked but not yet sent (previewed above the composer)
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const online = useIsOnline(other?.id);
  const { otherTyping, notify, stop } = useTyping(conversationId, me?.id ?? null);

  useEffect(() => { void getChatUserId().then(setMe); }, []);

  const markRead = useCallback(() => {
    if (me && document.visibilityState === "visible") void markConversationRead(conversationId, me.id);
  }, [conversationId, me]);

  // Load conversation, other person, agreement, messages
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: conv } = await supabase
        .from("conversations").select("id, buyer_id, vendor_id, delivery_agreement_id").eq("id", conversationId).single();
      if (cancelled || !conv) { setLoading(false); return; }
      setConversation(conv);

      const otherId = conv.vendor_id === me.id ? conv.buyer_id : conv.vendor_id;
      const otherIsStore = otherId === conv.vendor_id;
      if (otherId) {
        const { data: p } = await supabase
          .from("public_vendor_profiles").select("id, full_name, store_name, store_link").eq("id", otherId).maybeSingle();
        if (!cancelled) setOther({
          id: otherId,
          name: (otherIsStore ? p?.store_name : null) || p?.full_name || p?.store_name || (otherIsStore ? "Seller" : "Buyer"),
          storeLink: otherIsStore ? (p?.store_link || otherId) : null,
          isStore: otherIsStore,
        });
      } else if (!cancelled) {
        setOther({ id: "", name: "Guest buyer", isStore: false });
      }

      if (conv.delivery_agreement_id) {
        const { data: agr } = await supabase
          .from("delivery_agreements")
          .select("id, conversation_id, vendor_id, buyer_id, delivery_fee_ksh, delivery_method, status, proposed_by")
          .eq("id", conv.delivery_agreement_id).maybeSingle();
        if (!cancelled) setAgreement(agr as Agreement | null);
      } else setAgreement(null);

      const { data: msgs } = await supabase
        .from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      if (!cancelled) {
        setMessages((msgs || []) as ChatMessage[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId, me]);

  // Opening the chat reads it; so does coming back to the tab.
  useEffect(() => {
    if (loading) return;
    markRead();
    const onVisible = () => markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loading, markRead]);

  // Realtime: new messages, read receipts, and agreement changes
  useEffect(() => {
    const channel = supabase
      .channel(`thread-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as ChatMessage;
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        if (me && m.sender_id !== me.id) markRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as ChatMessage;
        setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, me, markRead]);

  useEffect(() => {
    if (!conversation?.delivery_agreement_id) return;
    const channel = supabase
      .channel(`thread-agreement-${conversation.delivery_agreement_id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "delivery_agreements", filter: `id=eq.${conversation.delivery_agreement_id}` }, (payload) => {
        setAgreement((a) => (a ? { ...a, ...(payload.new as Agreement) } : a));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation?.delivery_agreement_id]);

  // Keep the newest message in view
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, otherTyping, loading]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body || sending || !me || !conversation) return;
    setSending(true);
    stop();
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: me.id,
          sender_role: conversation.vendor_id === me.id ? "vendor" : me.isGuest ? "guest" : "user",
          message: body,
          message_type: "text",
        })
        .select()
        .single();
      if (error) throw error;
      if (data) setMessages((cur) => (cur.some((x) => x.id === data.id) ? cur : [...cur, data as ChatMessage]));
      setDraft("");
      inputRef.current?.focus();
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    } catch (e) {
      toast.error(e, { description: "Your message wasn't sent." });
    } finally {
      setSending(false);
    }
  };

  const pickPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_CHAT_PHOTOS - photos.length;
    if (files.length > room) toast.error(`You can send up to ${MAX_CHAT_PHOTOS} photos at a time`);
    try {
      const small = await compressImages(files.slice(0, Math.max(room, 0)));
      setPhotos((cur) => [...cur, ...small.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    } catch {
      toast.error("Couldn't read those photos. Try again.");
    }
  };

  const removePhoto = (i: number) => setPhotos((cur) => {
    URL.revokeObjectURL(cur[i].preview);
    return cur.filter((_, idx) => idx !== i);
  });

  const sendPhotos = async () => {
    if (!photos.length || sending || !me || !conversation) return;
    setSending(true);
    stop();
    try {
      const paths = await uploadChatPhotos(conversationId, me.id, photos.map((p) => p.file));
      const caption = draft.trim();
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: me.id,
          sender_role: conversation.vendor_id === me.id ? "vendor" : "user",
          message: caption || (paths.length === 1 ? "Photo" : `${paths.length} photos`),
          message_type: "image",
          metadata: { images: paths },
        })
        .select()
        .single();
      if (error) throw error;
      if (data) setMessages((cur) => (cur.some((x) => x.id === data.id) ? cur : [...cur, data as ChatMessage]));
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setDraft("");
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    } catch (e) {
      toast.error(e, { description: "Your photos weren't sent." });
    } finally {
      setSending(false);
    }
  };

  // Grow the box with the text, up to about five lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft]);

  const isVendor = !!me && conversation?.vendor_id === me.id;
  const chips = isVendor ? QUICK_REPLIES.vendor : QUICK_REPLIES.buyer;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-sunken">
      {/* Header */}
      <div className="flex flex-nowrap items-center gap-3 border-b border-border bg-background px-3 py-2.5 sm:px-4">
        {onBack && (
          <button onClick={onBack} aria-label="Back to conversations" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-sunken md:hidden">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="relative shrink-0">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background font-display text-lg">
            {(other?.name || "?").charAt(0).toUpperCase()}
          </div>
          {online && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{other?.name || "Loading…"}</p>
          <p className={`text-xs ${otherTyping ? "text-[hsl(40_62%_33%)] dark:text-primary" : online ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {otherTyping ? "typing…" : online ? "Online" : "Offline"}
          </p>
        </div>
        {other?.isStore && other.storeLink && (
          <Link to={`/store/${other.storeLink}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-sunken">
            <Store size={14} /> Store
          </Link>
        )}
      </div>

      {agreement && me && <DeliveryFeeBar agreement={agreement} userId={me.id} />}

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-5">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="font-display text-xl">Say hello</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Ask about sizes, photos or delivery. Your chat stays here with the order.
            </p>
          </div>
        ) : (
          <ChatMessages messages={messages} currentUserId={me?.id || ""} otherTyping={otherTyping} />
        )}
      </div>

      {/* Quick replies */}
      {!draft && !photos.length && !loading && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2 pt-1 scrollbar-hide sm:px-4" aria-label="Quick replies">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                // Promising photos opens the picker right away (must be in the tap itself)
                if (/photos/i.test(c) && isVendor && !me?.isGuest) fileRef.current?.click();
                void send(c);
              }}
              disabled={sending}
              className="shrink-0 rounded-full border border-border bg-background px-3 h-9 text-xs font-medium hover:border-foreground/40 active:scale-[0.97] transition"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-border bg-background px-3 pt-2.5 sm:px-4" aria-label="Photos to send">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sunken">
              <img src={p.preview} alt={`Photo ${i + 1} to send`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); void (photos.length ? sendPhotos() : send(draft)); }}
        className="flex flex-nowrap items-end gap-2 border-t border-border bg-background px-3 py-2.5 sm:px-4"
      >
        {/* Photos need an account (they go to private storage) */}
        {!me?.isGuest && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={sending || photos.length >= MAX_CHAT_PHOTOS}
              aria-label="Add photos"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-foreground/60 hover:bg-sunken hover:text-foreground disabled:opacity-40"
            >
              <ImagePlus size={21} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={pickPhotos} />
          </>
        )}
        <textarea
          ref={inputRef}
          value={draft}
          rows={1}
          onChange={(e) => { setDraft(e.target.value); notify(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void (photos.length ? sendPhotos() : send(draft)); }
          }}
          placeholder={photos.length ? "Add a caption (optional)" : "Message"}
          aria-label="Message"
          className="min-h-[44px] flex-1 resize-none rounded-3xl border border-border bg-sunken px-4 py-2.5 text-[15px] leading-snug outline-none focus:border-foreground/30"
        />
        <button
          type="submit"
          disabled={sending || (!draft.trim() && !photos.length)}
          aria-label="Send"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-[transform,opacity] active:scale-95 disabled:opacity-40"
        >
          {sending && photos.length ? <Loader2 size={19} className="animate-spin" /> : <SendHorizontal size={19} />}
        </button>
      </form>
    </div>
  );
};
