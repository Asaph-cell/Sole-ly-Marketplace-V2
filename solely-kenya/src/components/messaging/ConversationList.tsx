import { useEffect, useState, useCallback } from "react";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import { Check, CheckCheck, Truck, Handshake, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChatUserId } from "@/lib/chat";
import { useIsOnline } from "@/hooks/usePresence";

interface LastMessage {
  message: string;
  created_at: string;
  is_read: boolean;
  sender_id: string;
  message_type: string | null;
  metadata: any;
}

interface Conversation {
  id: string;
  vendor_id: string;
  buyer_id: string | null;
  updated_at: string;
  delivery_agreement_id: string | null;
  other_id: string | null;
  other_name: string;
  last_message: LastMessage | null;
  unread_count: number;
  delivery_status: string | null;
}

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId: string | null;
  isVendor: boolean;
}

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a").toLowerCase();
  if (isYesterday(d)) return "Yesterday";
  if (differenceInDays(new Date(), d) < 7) return format(d, "EEE");
  return format(d, "d MMM");
};

const preview = (m: LastMessage) => {
  if (m.message_type === "delivery_proposal") {
    const fee = Number(m.metadata?.delivery_fee ?? 0);
    return fee === 0 ? "Delivery offer: pick up" : `Delivery offer: KES ${fee.toLocaleString()}`;
  }
  if (m.message_type === "delivery_accepted") return "Delivery fee agreed";
  return m.message.replace(/^[✅❌]\s*/, "");
};

const Avatar = ({ name, userId }: { name: string; userId: string | null }) => {
  const online = useIsOnline(userId);
  return (
    <div className="relative shrink-0">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-foreground text-background font-display text-lg">
        {name.charAt(0).toUpperCase()}
      </div>
      {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-success" aria-label="Online" />}
    </div>
  );
};

export const ConversationList = ({ onSelectConversation, selectedConversationId }: ConversationListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    try {
      const { id: me } = await getChatUserId();
      setMeId(me);

      const { data: convData, error } = await supabase
        .from("conversations")
        .select("id, vendor_id, buyer_id, updated_at, delivery_agreement_id")
        .or(`buyer_id.eq.${me},vendor_id.eq.${me}`)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      if (!convData?.length) { setConversations([]); return; }

      const ids = convData.map((c) => c.id);
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id, message, created_at, is_read, sender_id, message_type, metadata")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false });

      const last: Record<string, LastMessage> = {};
      const unread: Record<string, number> = {};
      for (const m of msgs || []) {
        if (!last[m.conversation_id]) last[m.conversation_id] = m as LastMessage;
        if (!m.is_read && m.sender_id !== me) unread[m.conversation_id] = (unread[m.conversation_id] || 0) + 1;
      }

      const otherIds = [...new Set(convData.map((c) => (c.vendor_id === me ? c.buyer_id : c.vendor_id)).filter(Boolean))] as string[];
      const names: Record<string, { full_name: string | null; store_name: string | null }> = {};
      if (otherIds.length) {
        const { data: profiles } = await supabase.from("public_vendor_profiles").select("id, full_name, store_name").in("id", otherIds);
        for (const p of profiles || []) names[p.id] = p;
      }

      const agreementIds = [...new Set(convData.map((c) => c.delivery_agreement_id).filter(Boolean))] as string[];
      const statuses: Record<string, string> = {};
      if (agreementIds.length) {
        const { data: agreements } = await supabase.from("delivery_agreements").select("id, status").in("id", agreementIds);
        for (const a of agreements || []) statuses[a.id] = a.status;
      }

      setConversations(convData.map((c) => {
        const otherIsStore = c.vendor_id !== me;
        const otherId = otherIsStore ? c.vendor_id : c.buyer_id;
        const p = otherId ? names[otherId] : undefined;
        return {
          ...c,
          other_id: otherId,
          other_name: (otherIsStore ? p?.store_name : null) || p?.full_name || p?.store_name || (otherIsStore ? "Seller" : otherId ? "Buyer" : "Guest buyer"),
          last_message: last[c.id] || null,
          unread_count: c.id === selectedConversationId ? 0 : unread[c.id] || 0,
          delivery_status: c.delivery_agreement_id ? statuses[c.delivery_agreement_id] || null : null,
        };
      }));
    } catch (e) {
      console.error("Error loading conversations:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("conversation-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading conversations…</div>;

  const unreadTotal = conversations.filter((c) => c.unread_count > 0).length;
  const shown = filter === "unread" ? conversations.filter((c) => c.unread_count > 0) : conversations;

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b border-border px-3 py-2.5">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${filter === f ? "bg-foreground text-background" : "bg-sunken text-foreground hover:bg-sunken/70"}`}
          >
            {f === "all" ? "All" : `Unread${unreadTotal ? ` (${unreadTotal})` : ""}`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
          <MessageCircle size={28} strokeWidth={1.5} className="text-foreground/30" />
          <p className="text-sm">{filter === "unread" ? "You're all caught up" : "No conversations yet"}</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {shown.map((c) => {
            const unread = c.unread_count > 0;
            const mine = c.last_message?.sender_id === meId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setConversations((cur) => cur.map((x) => (x.id === c.id ? { ...x, unread_count: 0 } : x)));
                    onSelectConversation(c.id);
                  }}
                  className={`flex w-full flex-nowrap items-center gap-3 px-3 py-3 text-left transition-colors ${selectedConversationId === c.id ? "bg-sunken" : "hover:bg-sunken/60"}`}
                >
                  <Avatar name={c.other_name} userId={c.other_id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-nowrap items-baseline justify-between gap-2">
                      <p className={`truncate ${unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>{c.other_name}</p>
                      {c.last_message && (
                        <span className={`shrink-0 text-xs ${unread ? "font-semibold text-[hsl(40_62%_33%)] dark:text-primary" : "text-muted-foreground"}`}>
                          {timeLabel(c.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-nowrap items-center gap-2">
                      <p className={`flex min-w-0 flex-1 items-center gap-1 truncate text-sm ${unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {mine && c.last_message && (c.last_message.is_read
                          ? <CheckCheck size={15} className="shrink-0 text-[hsl(205_80%_45%)]" aria-label="Seen" />
                          : <Check size={15} className="shrink-0 text-foreground/45" aria-label="Sent" />)}
                        <span className="truncate">{c.last_message ? preview(c.last_message) : "No messages yet"}</span>
                      </p>
                      {unread && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground" aria-label={`${c.unread_count} unread`}>
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    {c.delivery_status && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        {c.delivery_status === "agreed" ? <Handshake size={12} /> : <Truck size={12} />}
                        {c.delivery_status === "agreed" ? "Delivery fee agreed" : c.delivery_status === "used" ? "Order placed" : c.delivery_status === "expired" ? "Offer expired" : "Agreeing delivery fee"}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
