import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

/**
 * A buyer who has filled in their address and opened a delivery chat is as
 * close to buying as anyone gets, but until now they were invisible here:
 * PendingOrdersBanner only watches orders that are already paid, and a
 * negotiation isn't an order yet. The only hint was an unread badge in the
 * sidebar, which is easy to miss - a vendor could lose a sale simply by not
 * opening the chat.
 */

interface Waiting {
    id: string;
    updatedAt: string;
}

export const DeliveryInquiryBanner = () => {
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
                    .map((a) => ({ id: a.id, updatedAt: a.updated_at }))
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
            .channel("delivery-inquiry-banner")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "delivery_agreements", filter: `vendor_id=eq.${user.id}` },
                () => load()
            )
            // A new message flips whose turn it is, so the banner has to react
            // to messages too, not just to the agreement row.
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => load())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, load]);

    if (loading || waiting.length === 0) return null;

    const oldest = waiting[waiting.length - 1];

    return (
        <div className="bg-primary text-primary-foreground px-4 py-3">
            <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="bg-black/15 p-2 rounded-full">
                        <MessageCircle size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="font-semibold">
                            {waiting.length === 1
                                ? "A buyer is waiting on you"
                                : `${waiting.length} buyers are waiting on you`}
                        </p>
                        <p className="text-sm opacity-90">
                            Delivery still to agree — asked{" "}
                            {formatDistanceToNow(new Date(oldest.updatedAt), { addSuffix: true })}
                        </p>
                    </div>
                </div>

                <Link to="/vendor/messages">
                    <Button variant="secondary" size="sm" className="bg-white text-primary hover:bg-white/90">
                        Open chat
                    </Button>
                </Link>
            </div>
        </div>
    );
};
