import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInHours, differenceInMinutes } from "date-fns";
import { AlertStrip } from "./AlertStrip";

interface PendingOrder {
    id: string;
    created_at: string;
    total_ksh: number;
}

const WINDOW_HOURS = 48;

// Time left to accept, from when the order was placed.
export const acceptTimeLeft = (createdAt: string, now: Date) => {
    const deadline = new Date(new Date(createdAt).getTime() + WINDOW_HOURS * 60 * 60 * 1000);
    const hours = differenceInHours(deadline, now);
    const minutes = differenceInMinutes(deadline, now) % 60;
    if (hours < 0 || (hours === 0 && minutes <= 0)) return { text: "expired", urgent: true, expired: true };
    return {
        text: hours < 6 ? `${hours}h ${minutes}m left` : `${hours}h left`,
        urgent: hours < 6,
        expired: false,
    };
};

/**
 * Paid orders waiting for the vendor to accept, oldest first, kept live.
 * Shared by the strip below and the dashboard's to-do list so both always
 * agree on the count and the countdown.
 */
export const usePendingOrders = () => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!user) return;

        const fetchPendingOrders = async () => {
            try {
                // Only orders under 48 hours old; older ones are already missed.
                const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
                const { data, error } = await supabase
                    .from("orders")
                    .select("id, created_at, total_ksh, payments(id, status, amount_ksh)")
                    .eq("vendor_id", user.id)
                    .eq("status", "pending_vendor_confirmation")
                    .gte("created_at", cutoff)
                    .order("created_at", { ascending: true });

                if (error) throw error;

                // Only fully paid orders count as waiting on the vendor.
                const paid = (data || []).filter((order: any) => {
                    const totalPaid = (order.payments || [])
                        .filter((p: any) => p.status === "captured")
                        .reduce((sum: number, p: any) => sum + Number(p.amount_ksh || 0), 0);
                    return totalPaid >= order.total_ksh;
                });

                setOrders(paid.map((o: any) => ({ id: o.id, created_at: o.created_at, total_ksh: o.total_ksh })));
            } catch (error) {
                console.error("Error fetching pending orders:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPendingOrders();

        // Unique name so the strip and the dashboard can both subscribe.
        const channel = supabase
            .channel(`pending-orders-${crypto.randomUUID()}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "orders", filter: `vendor_id=eq.${user.id}` },
                () => fetchPendingOrders()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const active = orders.filter((o) => !acceptTimeLeft(o.created_at, now).expired);
    const expired = orders.filter((o) => acceptTimeLeft(o.created_at, now).expired);
    // Oldest active order sets the deadline the vendor has to beat.
    const deadline = active[0] ? acceptTimeLeft(active[0].created_at, now) : null;

    return { active, expired, deadline, loading };
};

// Pages that already show pending orders themselves.
const HIDDEN_ON = ["/vendor/dashboard", "/vendor/orders"];

export const PendingOrdersBanner = () => {
    const { pathname } = useLocation();
    if (HIDDEN_ON.includes(pathname)) return null;
    return <PendingOrdersStrip />;
};

const PendingOrdersStrip = () => {
    const { active, expired, deadline, loading } = usePendingOrders();
    if (loading) return null;

    if (active.length > 0 && deadline) {
        return (
            <AlertStrip
                tone={deadline.urgent ? "urgent" : "attention"}
                text={`${active.length} order${active.length === 1 ? "" : "s"} waiting for you`}
                detail={`${deadline.text} to accept`}
                to="/vendor/orders"
                cta="Review"
            />
        );
    }

    if (expired.length > 0) {
        return (
            <AlertStrip
                tone="quiet"
                text={`${expired.length} order${expired.length === 1 ? "" : "s"} expired`}
                detail="the buyer has been refunded"
                to="/vendor/orders"
                cta="View"
            />
        );
    }

    return null;
};
