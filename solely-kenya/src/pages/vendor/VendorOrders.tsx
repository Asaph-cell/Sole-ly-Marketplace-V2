import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { clearAppBadge } from "@/lib/badge";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { ChevronDown, Clock, Package } from "lucide-react";
import { LocationViewMap } from "@/components/LocationViewMap";
import { VendorNextStep } from "@/components/orders/VendorNextStep";
import { useOrderTimers, usePackingChecklists } from "@/lib/orderFlow";

type OrderRecord = Tables<"orders"> & {
  order_items: Tables<"order_items">[];
  order_shipping_details: Tables<"order_shipping_details"> | null;
  disputes?: Tables<"disputes">[];
  payments?: Array<{
    id: string;
    status: string;
    amount_ksh: number;
    metadata?: { is_delivery_fee?: boolean };
  }>;
};

const VendorOrders = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("newest");

  const { timers } = useOrderTimers(
    useMemo(() => orders.filter((o) => ["accepted", "shipped", "arrived", "delivered", "disputed"].includes(o.status)).map((o) => o.id), [orders]),
    orders,
  );
  const { checklists } = usePackingChecklists(
    useMemo(() => orders.filter((o) => o.status === "accepted").map((o) => o.id), [orders]),
    orders,
  );

  const loadOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      // First, fetch orders without payments to avoid potential RLS issues
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          `*,
          order_items(*),
          order_shipping_details(*),
          disputes(*)`
        )
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Failed to fetch vendor orders", ordersError);
        toast.error("Unable to load orders");
        setLoadingOrders(false);
        return;
      }

      // Then fetch payments separately for each order (non-blocking)
      // Fetch payments in parallel but don't block if they fail
      const ordersWithPayments = await Promise.all(
        (ordersData || []).map(async (order) => {
          try {
            const { data: paymentsData, error: paymentsError } = await supabase
              .from("payments")
              .select("id, status, amount_ksh, metadata")
              .eq("order_id", order.id)
              .order("created_at", { ascending: true });

            if (paymentsError) {
              console.warn(`Payment fetch warning for order ${order.id}:`, paymentsError);
              // Continue with empty payments array
              return {
                ...order,
                payments: [],
              };
            }

            return {
              ...order,
              payments: paymentsData || [],
            };
          } catch (error) {
            // If payment fetch fails, continue with empty payments array
            console.warn(`Error fetching payments for order ${order.id}:`, error);
            return {
              ...order,
              payments: [],
            };
          }
        })
      );

      // Show ALL orders except cancelled ones - payment status will be shown as badge
      // This ensures vendors always see orders even if payment webhook was delayed
      const visibleOrders = ordersWithPayments.filter((order) => {
        // Hide cancelled orders, abandoned checkouts, and unpaid orders
        const isHidden = [
          "pending_payment",
          "cancelled_by_vendor",
          "cancelled_by_customer",
        ].includes(order.status);

        return !isHidden;
      });

      setOrders(visibleOrders as unknown as OrderRecord[]);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoadingOrders(false);
    }
  };



  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadOrders();

      // Clear PWA badge when viewing orders (notification seen)
      clearAppBadge();

      const channel = supabase
        .channel('vendor-orders-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `vendor_id=eq.${user.id}`,
          },
          () => {
            loadOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
            // Listen to all payment changes - loadOrders will filter to this vendor's orders
          },
          () => {
            loadOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  // Only count genuinely actionable pending orders (not expired/missed ones)
  const pendingOrders = useMemo(() =>
    orders.filter((order) =>
      order.status === "pending_vendor_confirmation" &&
      differenceInHours(new Date(), new Date(order.created_at)) < 48
    ),
  [orders]);

  // Sort orders based on user selection
  const sortedOrders = useMemo(() => {
    const statusPriority: Record<string, number> = {
      pending_vendor_confirmation: 1,
      accepted: 2,
      shipped: 3,
      arrived: 4,
      completed: 5,
      disputed: 6,
      refunded: 7,
      cancelled_by_vendor: 8,
      cancelled_by_customer: 9,
    };

    return [...orders].sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "pending":
          // Active pending first, then expired pending, then rest by date
          const aActivePending = a.status === "pending_vendor_confirmation" && differenceInHours(new Date(), new Date(a.created_at)) < 48;
          const bActivePending = b.status === "pending_vendor_confirmation" && differenceInHours(new Date(), new Date(b.created_at)) < 48;
          const aExpiredPending = a.status === "pending_vendor_confirmation" && !aActivePending;
          const bExpiredPending = b.status === "pending_vendor_confirmation" && !bActivePending;
          if (aActivePending && !bActivePending) return -1;
          if (bActivePending && !aActivePending) return 1;
          if (aExpiredPending && !bExpiredPending) return -1;
          if (bExpiredPending && !aExpiredPending) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "shipped":
          // Shipped/Arrived first (need action)
          const aIsShipped = ["shipped", "arrived"].includes(a.status);
          const bIsShipped = ["shipped", "arrived"].includes(b.status);
          if (aIsShipped && !bIsShipped) return -1;
          if (bIsShipped && !aIsShipped) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "completed":
          if (a.status === "completed" && b.status !== "completed") return -1;
          if (b.status === "completed" && a.status !== "completed") return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [orders, sortBy]);

  // Helper to check if order is expired (48 hours passed)
  const isOrderExpired = (order: OrderRecord): boolean => {
    const hoursSinceOrder = differenceInHours(new Date(), new Date(order.created_at));
    return hoursSinceOrder >= 48;
  };

  const refreshAll = () => loadOrders();

  // ── Status helpers ──────────────────────────────────────────────────────────
  const STATUS_PILL: Record<string, string> = {
    pending_payment: "bg-muted text-muted-foreground   border border-dashed border-border",
    pending_vendor_confirmation: "bg-primary-soft text-primary-strong  ",
    accepted:   "bg-muted text-foreground  ",
    shipped:    "bg-muted text-foreground  ",
    arrived:    "bg-muted text-foreground  ",
    completed:  "bg-success-soft text-success  ",
    disputed:   "bg-destructive-soft text-destructive  ",
    refunded:   "bg-muted text-foreground  ",
  };
  const STATUS_LABEL_MAP: Record<string, string> = {
    pending_payment: "Awaiting Payment",
    pending_vendor_confirmation: "Needs Action",
    accepted: "Accepted",
    shipped: "In Transit",
    arrived: "Delivered",
    completed: "Completed",
    disputed: "Disputed",
    refunded: "Refunded",
  };

  return (
    <div className="min-h-screen bg-muted/30 overflow-x-hidden">
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/vendor/dashboard")}
                className="h-8 w-8 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Back to dashboard"
              >
                ‹
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Orders</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pendingOrders.length > 0
                    ? <span className="text-primary-strong font-semibold">{pendingOrders.length} need{pendingOrders.length === 1 ? "s" : ""} action</span>
                    : "All caught up"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Sort…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="pending">Pending first</SelectItem>
                  <SelectItem value="shipped">Shipped first</SelectItem>
                  <SelectItem value="completed">Completed first</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadOrders} className="h-9 text-xs px-3">Refresh</Button>
            </div>
          </div>

          {/* Orders list */}
          {loadingOrders ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4"><Package size={28} strokeWidth={1.5} className="text-muted-foreground" /></div>
              <p className="font-semibold mb-1">No orders yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">Orders appear here as soon as buyers checkout with your products.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedOrders.map((order) => {
                const isPickup = (order.order_shipping_details as any)?.delivery_type === "pickup";
                const isExpanded = expandedOrderId === order.id;
                const isPending = order.status === "pending_vendor_confirmation";
                const isExpired = isPending && isOrderExpired(order);
                const pillClass = isExpired
                  ? "bg-muted text-muted-foreground"
                  : STATUS_PILL[order.status] ?? "bg-muted text-muted-foreground";
                const labelText = isExpired
                  ? "Missed Order"
                  : isPickup && order.status === "arrived" ? "Ready for Pickup"
                  : STATUS_LABEL_MAP[order.status] ?? order.status.replace(/_/g, " ");

                return (
                  <div key={order.id} className={`bg-card rounded-2xl border ${isPending && !isExpired ? "border-primary/30 " : "border-border"}`}>

                    {/* Collapsed header, tap to expand */}
                    <button className="w-full text-left px-4 py-3.5 flex items-start gap-3"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                      <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        isPending && !isExpired ? "bg-primary" :
                        isExpired ? "bg-muted-foreground" :
                        order.status === "completed" ? "bg-success" :
                        order.status === "shipped" ? "bg-foreground" :
                        order.status === "disputed" ? "bg-destructive" : "bg-border"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">#{order.id.slice(0, 10)}</p>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pillClass}`}>{labelText}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })} · KES {order.total_ksh.toLocaleString()}{isPickup ? " · Pickup" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {order.order_items?.map(i => `${i.quantity}× ${i.product_name}`).join(", ")}
                        </p>
                      </div>
                      <ChevronDown size={16} strokeWidth={1.75} className={`mt-1 shrink-0 text-muted-foreground transition-transform duration-200 ease-out ${isExpanded ? "rotate-180" : ""}`} />
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

                        {/* Items, financials & delivery, hidden for missed orders */}
                        {!isExpired && (<>

                        {/* Top Actions */}
                        <div className="flex justify-end pb-3 mb-3 border-b border-border/50">
                          <button
                            onClick={() => window.print()}
                            className="text-[11px] font-semibold px-3 py-1.5 bg-muted text-foreground rounded-md hover:bg-muted transition print:hidden"
                          >
                            Download Receipt / Invoice
                          </button>
                        </div>

                        {/* Items */}
                        <div className="space-y-1">
                          {order.order_items?.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.quantity} × {item.product_name}
                                {/* Size lives only in the snapshot - order_items has no size column. */}
                                {(item.product_snapshot as any)?.size && <span className="text-muted-foreground ml-1">(Size {(item.product_snapshot as any).size})</span>}
                                {(item.color || (item.product_snapshot as any)?.color) && <span className="text-muted-foreground ml-1">({item.color || (item.product_snapshot as any)?.color})</span>}
                              </span>
                              <span className="font-medium">KES {(item.quantity * item.unit_price_ksh).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>

                        {/* Financials */}
                        <div className="bg-muted/60 rounded-xl p-3 text-xs space-y-1">
                          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>KES {order.subtotal_ksh.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>KES {order.shipping_fee_ksh.toLocaleString()}</span></div>
                          <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span>KES {order.total_ksh.toLocaleString()}</span></div>
                          <div className="flex justify-between text-muted-foreground"><span>Commission ({order.commission_rate}%)</span><span>− KES {order.commission_amount.toLocaleString()}</span></div>
                          <div className="flex justify-between text-success font-semibold"><span>Your payout</span><span>KES {order.payout_amount.toLocaleString()}</span></div>
                        </div>

                        {/* Delivery info */}
                        <div className="bg-muted/40 rounded-xl p-3 text-xs space-y-1">
                          <p className="font-semibold text-sm mb-1">{isPickup ? "Pickup Info" : "Delivery Info"}</p>
                          {order.status === "completed" ? (
                            <p className="text-muted-foreground">Completed. Customer details are hidden for privacy.</p>
                          ) : order.order_shipping_details ? (
                            <>
                              <p><span className="text-muted-foreground">Recipient: </span>{order.order_shipping_details.recipient_name}</p>
                              <p><span className="text-muted-foreground">Phone: </span>{order.order_shipping_details.phone}</p>
                              {isPickup ? (
                                <p className="text-success font-medium mt-1">Customer collects from your location.</p>
                              ) : (
                                <>
                                  <p><span className="text-muted-foreground">Address: </span>{order.order_shipping_details.address_line1}{order.order_shipping_details.city ? `, ${order.order_shipping_details.city}` : ""}</p>
                                  {order.order_shipping_details.delivery_notes && (
                                    <p className="text-foreground mt-1"><span className="font-medium">Note: </span>{order.order_shipping_details.delivery_notes}</p>
                                  )}
                                  {order.order_shipping_details.gps_latitude && order.order_shipping_details.gps_longitude && (
                                    <div className="mt-2">
                                      <LocationViewMap
                                        latitude={order.order_shipping_details.gps_latitude}
                                        longitude={order.order_shipping_details.gps_longitude}
                                        address={order.order_shipping_details.address_line1 || undefined}
                                        recipientName={order.order_shipping_details.recipient_name}
                                        compact={true}
                                      />
                                    </div>
                                  )}
                                  {order.shipping_fee_ksh > 0 ? (
                                    <p className="text-muted-foreground mt-1">The delivery fee (KES {order.shipping_fee_ksh.toLocaleString()}) was paid by the buyer and will be included in your payout.</p>
                                  ) : (
                                    <p className="text-muted-foreground mt-1">🆓 Free delivery was offered for this order.</p>
                                  )}
                                </>
                              )}
                            </>
                          ) : null}
                        </div>

                        </>)}

                        {isExpired ? (
                          <div className="rounded-xl border border-muted bg-muted/50 p-4 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Clock size={16} strokeWidth={1.75} className="text-muted-foreground" />
                              <p className="text-sm font-semibold text-muted-foreground">Missed order, refunded</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              This order wasn't accepted within 48 hours, so the buyer was refunded automatically.
                            </p>
                          </div>
                        ) : (
                          <VendorNextStep
                            order={order}
                            timers={timers[order.id]}
                            checklist={checklists[order.id]}
                            hasDispute={!!order.disputes?.length}
                            onChanged={refreshAll}
                          />
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

    </div>
  );
};

export default VendorOrders;

