import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { AlertStrip } from "./AlertStrip";

/**
 * A buyer who has filled in their address and opened a delivery chat is as
 * close to buying as anyone gets, but a negotiation isn't an order yet, so
 * the pending-orders alert never sees them. Without this a vendor could lose
 * a sale simply by not opening the chat.
 */

interface Waiting {
    id: string;
    conversationId: string | null;
    updatedAt: string;
}

/** Delivery chats where the buyer spoke last, newest first, kept live. */
export const useWaitingDeliveryChats = () => {
    const { user } = useAuth();
    const [waiting, setWaiting] = useState<Waiting[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!user) return;
        try {
            const { data: agreements } = await supabase
                .from("delivery_agreements")
                .select("id, conversation_id, updated_at")
                .eq("vendor_id", user.id)
                .eq("status", "negotiating")
                .order("updated_at", { ascending: false });

            if (!agreements?.length) {
                setWaiting([]);
                return;
            }

            const convIds = agreements.map((a) => a.conversation_id).filter(Boolean) as string[];
            const { data: messages } = convIds.length
                ? await supabase
                    .from("messages")
                    .select("conversation_id, sender_id, created_at")
                    .in("conversation_id", convIds)
                    .order("created_at", { ascending: false })
                : { data: [] as any[] };

            // Whose turn is it? Only surface threads where the newest message
            // came from the buyer - once the vendor has replied the ball is
            // back with the buyer and nagging them here would be noise.
            const lastSender = new Map<string, string>();
            (messages || []).forEach((m: any) => {
                if (!lastSender.has(m.conversation_id)) lastSender.set(m.conversation_id, m.sender_id);
            });

            setWaiting(
                agreements
                    .filter((a) => {
                        if (!a.conversation_id) return true; // opened, nothing said yet
                        const last = lastSender.get(a.conversation_id);
                        return !last || last !== user.id;
                    })
                    .map((a) => ({
                        id: a.id,
                        conversationId: a.conversation_id ?? null,
                        updatedAt: a.updated_at,
                    }))
            );
        } catch (error) {
            console.error("Error loading delivery inquiries:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        load();
        if (!user) return;

        const channel = supabase
            .channel(`delivery-inquiries-${crypto.randomUUID()}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "delivery_agreements", filter: `vendor_id=eq.${user.id}` },
                () => load()
            )
            // A new message flips whose turn it is, so react to messages too.
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => load())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, load]);

    const oldest = waiting[waiting.length - 1];
    // Open the thread the alert is describing (the oldest one waiting). A
    // negotiation opened before anyone spoke has no conversation yet, so that
    // case falls back to the list.
    const to = oldest?.conversationId ? `/vendor/messages?conversation=${oldest.conversationId}` : "/vendor/messages";

    return { waiting, oldest, to, loading };
};

// The dashboard lists these in its to-do list; Messages shows the chats.
const HIDDEN_ON = ["/vendor/dashboard", "/vendor/messages"];

export const DeliveryInquiryBanner = () => {
    const { pathname } = useLocation();
    if (HIDDEN_ON.includes(pathname)) return null;
    return <DeliveryInquiryStrip />;
};

const DeliveryInquiryStrip = () => {
    const { waiting, oldest, to, loading } = useWaitingDeliveryChats();
    if (loading || !oldest) return null;

    return (
        <AlertStrip
            tone="attention"
            text={waiting.length === 1 ? "A buyer is waiting on you" : `${waiting.length} buyers are waiting on you`}
            detail={`delivery to agree, asked ${formatDistanceToNow(new Date(oldest.updatedAt), { addSuffix: true })}`}
            to={to}
            cta="Open chat"
        />
    );
};
