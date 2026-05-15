import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInHours, differenceInMinutes } from "date-fns";
import { AlertTriangle, Clock, Package, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingOrder {
    id: string;
    created_at: string;
    total_ksh: number;
}

export const PendingOrdersBanner = () => {
    const { user } = useAuth();
    const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update time every minute for countdown
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, []);

    // Fetch pending orders
    useEffect(() => {
        const fetchPendingOrders = async () => {
            if (!user) return;

            try {
                // Only fetch orders under 48 hours old — expired ones are already missed
                const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
                const { data: orders, error } = await supabase
                    .from("orders")
                    .select(`
            id, 
            created_at, 
            total_ksh,
            payments(id, status, amount_ksh)
          `)
                    .eq("vendor_id", user.id)
                    .eq("status", "pending_vendor_confirmation")
                    .gte("created_at", cutoff)
                    .order("created_at", { ascending: true });

                if (error) throw error;

                // Filter to only include fully paid orders that are under 48 hours old
                const paidOrders = (orders || []).filter((order: any) => {
                    // Double-check age client-side (DB filter is primary, this is safety net)
                    if (differenceInHours(new Date(), new Date(order.created_at)) >= 48) return false;
                    const totalPaid = (order.payments || [])
                        .filter((p: any) => p.status === "captured")
                        .reduce((sum: number, p: any) => sum + Number(p.amount_ksh || 0), 0);
                    return totalPaid >= order.total_ksh;
                });

                setPendingOrders(paidOrders.map((o: any) => ({
                    id: o.id,
                    created_at: o.created_at,
                    total_ksh: o.total_ksh,
                })));
            } catch (error) {
                console.error("Error fetching pending orders:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPendingOrders();

        // Real-time subscription for new orders
        const channel = supabase
            .channel('pending-orders-banner')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `vendor_id=eq.${user?.id}`,
                },
                () => {
                    fetchPendingOrders();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Calculate time remaining for the most urgent order
    const getTimeRemaining = (createdAt: string) => {
        const created = new Date(createdAt);
        const deadline = new Date(created.getTime() + 48 * 60 * 60 * 1000); // 48 hours from creation
        const hoursLeft = differenceInHours(deadline, currentTime);
        const minutesLeft = differenceInMinutes(deadline, currentTime) % 60;

        if (hoursLeft < 0) {
            return { text: "OVERDUE", urgent: true, expired: true };
        } else if (hoursLeft < 2) {
            return { text: `${hoursLeft}h ${minutesLeft}m left`, urgent: true, expired: false };
        } else if (hoursLeft < 6) {
            return { text: `${hoursLeft}h ${minutesLeft}m left`, urgent: true, expired: false };
        } else {
            return { text: `${hoursLeft}h left`, urgent: false, expired: false };
        }
    };

    if (loading || pendingOrders.length === 0) {
        return null;
    }

    // Separate expired and active orders
    const expiredOrders = pendingOrders.filter(o => getTimeRemaining(o.created_at).expired);
    const activeOrders = pendingOrders.filter(o => !getTimeRemaining(o.created_at).expired);

    // If there are expired orders, show "missed order" banner
    if (expiredOrders.length > 0) {
        return (
            <div className="bg-gray-800 text-white px-4 py-3">
                <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-700 p-2 rounded-full">
                            <XCircle className="h-5 w-5 text-gray-300" />
                        </div>
                        <div>
                            <p className="font-semibold">
                                {expiredOrders.length === 1
                                    ? "You missed an order!"
                                    : `You missed ${expiredOrders.length} orders!`}
                            </p>
                            <p className="text-sm opacity-90">
                                These orders will be auto-cancelled with buyer refund. Respond faster next time!
                            </p>
                        </div>
                    </div>

                    <Link to="/vendor/orders">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white text-gray-800 hover:bg-gray-200"
                        >
                            View Details
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    // If no active orders after filtering, don't show banner
    if (activeOrders.length === 0) {
        return null;
    }

    // Get the most urgent active order (oldest)
    const mostUrgentOrder = activeOrders[0];
    const timeRemaining = getTimeRemaining(mostUrgentOrder.created_at);

    return (
        <div className={`${timeRemaining.urgent ? 'bg-red-600' : 'bg-amber-500'} text-white px-4 py-3`}>
            <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`${timeRemaining.urgent ? 'bg-red-700' : 'bg-amber-600'} p-2 rounded-full`}>
                        {timeRemaining.urgent ? (
                            <AlertTriangle className="h-5 w-5 animate-pulse" />
                        ) : (
                            <Package className="h-5 w-5" />
                        )}
                    </div>
                    <div>
                        <p className="font-semibold">
                            {activeOrders.length === 1
                                ? "1 Pending Order"
                                : `${activeOrders.length} Pending Orders`}
                        </p>
                        <p className="text-sm opacity-90 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeRemaining.text} to accept
                        </p>
                    </div>
                </div>

                <Link to="/vendor/orders">
                    <Button
                        variant="secondary"
                        size="sm"
                        className={timeRemaining.urgent ? "bg-white text-red-600 hover:bg-red-100" : "bg-white text-amber-600 hover:bg-amber-100"}
                    >
                        View Orders
                    </Button>
                </Link>
            </div>
        </div>
    );
};
