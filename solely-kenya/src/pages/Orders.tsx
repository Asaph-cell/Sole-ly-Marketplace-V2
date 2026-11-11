import { useEffect, useMemo, useState } from "react";
import { celebrate } from "@/components/Celebration";
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { OrderReviewDialog } from "@/components/OrderReviewDialog";
import { OrderReceipt } from "@/components/OrderReceipt";
import { LiveDeliveryTracker } from "@/components/LiveDeliveryTracker";
import { TrackingTimeline } from "@/components/tracking/TrackingTimeline";
import { BuyerNextStep } from "@/components/orders/BuyerNextStep";
import { useOrderTimers, usePackingChecklists } from "@/lib/orderFlow";
import { Phone, MessageCircle, PhoneCall, CheckCircle, Download, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


type OrderRecord = Tables<"orders"> & {
  order_items: Tables<"order_items">[];
  order_shipping_details: Tables<"order_shipping_details"> | null;
  payments?: Tables<"payments">[];
  disputes?: Tables<"disputes">[] | Tables<"disputes"> | null;
};

// Helper component for contact vendor button with multiple options
const ContactVendorButton = ({ phoneNumber, className = "" }: { phoneNumber: string; className?: string }) => {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  // Format for tel: and sms: links (Kenya country code 254)
  let telNumber = cleanNumber;
  if (!telNumber.startsWith('254')) {
    // Remove leading 0 if present and add 254
    telNumber = `254${telNumber.replace(/^0/, '')}`;
  }
  // WhatsApp uses the clean number as-is (it handles country codes automatically)
  const whatsappNumber = cleanNumber;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={className}
        >
          <Phone size={16} strokeWidth={1.5} className=" mr-2" />
          Contact Vendor
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 cursor-pointer"
          >
            <MessageCircle size={16} strokeWidth={1.5}  />
            WhatsApp
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`tel:${telNumber}`}
            className="flex items-center gap-2 cursor-pointer"
          >
            <PhoneCall size={16} strokeWidth={1.5}  />
            Phone Call
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`sms:${telNumber}`}
            className="flex items-center gap-2 cursor-pointer"
          >
            <MessageCircle size={16} strokeWidth={1.5}  />
            SMS
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending_payment: { label: "Payment pending", variant: "secondary" },
  pending_vendor_confirmation: { label: "Awaiting seller", variant: "secondary" },
  accepted: { label: "Being packed", variant: "default" },
  shipped: { label: "On the way", variant: "default" },
  arrived: { label: "Arrived", variant: "default" },
  delivered: { label: "Arrived", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  disputed: { label: "Problem reported", variant: "destructive" },
  refunded: { label: "Refunded", variant: "outline" },
  cancelled_by_vendor: { label: "Cancelled", variant: "destructive" },
  cancelled_by_customer: { label: "Cancelled", variant: "outline" },
};

const firstDispute = (o: OrderRecord) => (Array.isArray(o.disputes) ? o.disputes[0] : o.disputes) ?? null;

const Orders = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId?: string }>();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<OrderRecord | null>(null);
  const [vendorProfiles, setVendorProfiles] = useState<Record<string, any>>({});
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());
  const [detailsOpen, setDetailsOpen] = useState<Set<string>>(new Set());

  const activeIds = useMemo(
    () => orders.filter((o) => !["completed", "refunded", "cancelled_by_vendor", "cancelled_by_customer", "pending_payment"].includes(o.status)).map((o) => o.id),
    [orders],
  );
  const { timers } = useOrderTimers(activeIds, orders);
  const { checklists } = usePackingChecklists(
    useMemo(() => orders.filter((o) => o.status === "accepted").map((o) => o.id), [orders]),
    orders,
  );

  // Poll for payment status when returning from IntaSend (webhook may be delayed)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get('payment_success');

    if (paymentSuccess === 'true' && orderId) {
      console.log('[Orders] Payment redirect detected, polling for status...');

      // Poll every 2 seconds for up to 20 seconds
      let attempts = 0;
      const maxAttempts = 10;

      const pollInterval = setInterval(async () => {
        attempts++;
        console.log(`[Orders] Polling attempt ${attempts}/${maxAttempts}`);

        // Check if payment is captured
        const { data: payment } = await supabase
          .from('payments')
          .select('status')
          .eq('order_id', orderId)
          .eq('gateway', 'intasend')
          .single();

        if (payment?.status === 'captured') {
          console.log('[Orders] Payment confirmed!');
          clearInterval(pollInterval);
          celebrate({
            title: 'Payment confirmed',
            subtitle: 'Your money is held safely until you receive your order. The seller has been notified.',
            cta: 'Track my order',
          });
          // Clear URL params and refresh
          window.history.replaceState({}, '', `/orders/${orderId}`);
          window.location.reload();
        } else if (attempts >= maxAttempts) {
          console.log('[Orders] Polling timeout - webhook may still be processing');
          clearInterval(pollInterval);
          toast.info('Checking payment status... Please refresh if needed.');
        }
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [orderId]);


  const fetchOrders = async () => {
    if (!user) return;
    setRefreshing(true);
    const { data, error } = await supabase
      .from("orders")
      .select(
        `*,
        order_items(*),
        order_shipping_details(*),
        payments(*),
        disputes(*)`
      )
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load orders", error);
      toast.error("Failed to load orders");
      setRefreshing(false);
      return;
    }

    // Sort payments by created_at desc for each order
    const ordersWithSortedPayments = data?.map(order => ({
      ...order,
      payments: order.payments?.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }));

    setOrders((ordersWithSortedPayments as unknown as OrderRecord[]) ?? []);

    // Fetch vendor profiles for all orders
    if (data && data.length > 0) {
      const vendorIds = [...new Set(data.map(order => order.vendor_id))];
      const { data: profiles } = await supabase
        .from("public_vendor_profiles")
        .select("id, store_name, whatsapp_number, store_description")
        .in("id", vendorIds);

      if (profiles) {
        const profilesMap: Record<string, any> = {};
        profiles.forEach(profile => {
          profilesMap[profile.id] = profile;
        });
        setVendorProfiles(profilesMap);
      }
    }

    // Check which orders have been reviewed
    if (data && data.length > 0 && user) {
      const orderIds = data.map(order => order.id);
      const { data: vendorRatings } = await supabase
        .from("vendor_ratings")
        .select("order_id")
        .in("order_id", orderIds)
        .eq("buyer_id", user.id);

      if (vendorRatings) {
        setReviewedOrders(new Set(vendorRatings.map(r => r.order_id)));
      }
    }

    setRefreshing(false);
  };

  const refreshAll = () => fetchOrders();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      fetchOrders();

      // Real-time subscription for orders and payments
      const channel = supabase
        .channel('orders-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `customer_id=eq.${user.id}`,
          },
          () => {
            fetchOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
          },
          () => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  const handlePayDeliveryFee = async (order: OrderRecord) => {
    // Calculate remaining amount (delivery fee)
    const totalPaid = order.payments
      ?.filter((p: any) => p.status === 'captured' || p.status === 'completed')
      .reduce((sum: number, p: any) => sum + Number(p.amount_ksh), 0) || 0;

    const remainingAmount = order.total_ksh - totalPaid;

    if (remainingAmount <= 0) {
      toast.success("No pending payment found.");
      return;
    }

    setProcessingPayment(order.id);
    try {
      // Use IntaSend for payment
      const { data, error } = await supabase.functions.invoke('intasend-initiate-payment', {
        body: {
          orderId: order.id,
          successUrl: `${window.location.origin}/orders/${order.id}?payment_success=true`,
          cancelUrl: `${window.location.origin}/orders/${order.id}?cancelled=true`,
        }
      });

      if (error) {
        throw new Error(error.message || "Payment initiation failed");
      }

      if (!data?.success || !data?.url) {
        throw new Error(data?.error || "Failed to initiate payment");
      }

      toast.success("Opening payment page...");

      // Redirect to IntaSend payment page
      window.location.href = data.url;
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to initiate payment");
    } finally {
      setProcessingPayment(null);
    }
  };

  const printReceipt = (order: OrderRecord) => {
    setReceiptOrder(order);
    // Use setTimeout to ensure state is set before printing
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const receiptContent = document.getElementById('receipt-print-area');
        if (receiptContent) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Receipt - ${order.id.slice(0, 8)}</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                  .receipt { max-width: 800px; margin: 0 auto; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                  .text-right { text-align: right; }
                  .text-center { text-align: center; }
                  .font-bold { font-weight: bold; }
                  .text-green-600 { color: #16a34a; }
                  .bg-green-50 { background-color: #f0fdf4; padding: 16px; border-radius: 8px; }
                  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                </style>
              </head>
              <body>${receiptContent.innerHTML}</body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
        }
      }
      setReceiptOrder(null);
    }, 100);
  };

  const toggleDetails = (id: string) =>
    setDetailsOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-10 space-y-6 max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My Orders</h1>
            <p className="text-muted-foreground">Your money is held safely until you have your order.</p>
          </div>
          <Button variant="ghost" onClick={refreshAll} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {orders.length === 0 ? (
          <Card className="p-10 text-center">
            <CardTitle className="mb-4">You have no orders yet</CardTitle>
            <Button onClick={() => navigate("/shop")}>Start shopping</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isHighlighted = orderId && order.id === orderId;
              const status = statusLabels[order.status] ?? { label: order.status, variant: "secondary" };
              const isPickup = (order.order_shipping_details as any)?.delivery_type === "pickup";
              const storeName = vendorProfiles[order.vendor_id]?.store_name || "The seller";

              const totalPaid = order.payments
                ?.filter((p: any) => p.status === 'captured' || p.status === 'completed')
                .reduce((sum: number, p: any) => sum + Number(p.amount_ksh), 0) || 0;
              const pendingAmount = order.total_ksh - totalPaid;
              const hasPendingBalance = order.status === "pending_payment" && pendingAmount > 1; // Tolerance for float errors
              const showDetails = detailsOpen.has(order.id);

              const displayStatus = hasPendingBalance
                ? { label: "Payment Pending", variant: "destructive" as const }
                : status;

              return (
                <Card key={order.id} className={isHighlighted ? "border-primary" : undefined}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{storeName} · #{order.id.slice(0, 8)}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Placed {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={displayStatus.variant} className="shrink-0">{displayStatus.label}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm">
                      <p className="text-muted-foreground truncate">
                        {order.order_items?.map((item) => `${item.quantity}× ${item.product_name}`).join(", ")}
                      </p>
                      <p className="font-semibold mt-0.5">KES {order.total_ksh.toLocaleString()}</p>
                    </div>

                    {hasPendingBalance && (
                      <div className="bg-destructive-soft p-4 rounded-lg border border-destructive/30 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-destructive font-medium">Payment not completed</span>
                          <span className="text-destructive font-bold">KES {pendingAmount.toLocaleString()}</span>
                        </div>
                        <Button size="sm" className="w-full" variant="destructive"
                          onClick={() => handlePayDeliveryFee(order)} disabled={processingPayment === order.id}>
                          {processingPayment === order.id ? "Processing..." : "Retry Payment"}
                        </Button>
                      </div>
                    )}

                    {order.status === "cancelled_by_vendor" && (
                      <div className="bg-muted p-3 rounded-lg text-sm">
                        {storeName} cancelled this order. You've been refunded in full.
                      </div>
                    )}

                    {order.status === "refunded" && !firstDispute(order) && (
                      <div className="bg-muted p-3 rounded-lg text-sm">
                        This order was refunded{Number((order as any).refunded_ksh) > 0 ? ` (KES ${Number((order as any).refunded_ksh).toLocaleString()})` : ""}.
                      </div>
                    )}

                    <BuyerNextStep
                      order={order}
                      storeName={storeName}
                      timers={timers[order.id]}
                      checklist={checklists[order.id]}
                      hasDispute={!!firstDispute(order)}
                      onChanged={refreshAll}
                      onConfirmed={() => {
                        refreshAll();
                        setSelectedOrderForReview(order);
                        setReviewDialogOpen(true);
                      }}
                    />

                    {order.status === "shipped" && !isPickup && (
                      <LiveDeliveryTracker
                        orderId={order.id}
                        recipientName={order.order_shipping_details?.recipient_name || undefined}
                      />
                    )}

                    {order.status === "completed" && (
                      <div className="flex flex-wrap gap-3">
                        <Button size="sm" variant="outline" onClick={() => printReceipt(order)}>
                          <Download size={16} strokeWidth={1.5} className=" mr-1" />
                          Download Receipt
                        </Button>
                        {reviewedOrders.has(order.id) ? (
                          <div className="flex items-center gap-2 text-sm text-success">
                            <CheckCircle size={16} strokeWidth={1.5} />
                            Thank you for your review!
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => { setSelectedOrderForReview(order); setReviewDialogOpen(true); }}>
                            Leave Review
                          </Button>
                        )}
                      </div>
                    )}

                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => toggleDetails(order.id)}>
                      Order details
                      <ChevronDown size={14} className={`transition-transform ${showDetails ? "rotate-180" : ""}`} />
                    </button>

                    {showDetails && (
                      <div className="space-y-4">
                        <div className="space-y-1.5 text-sm">
                          {order.order_items?.map((item) => (
                            <div key={item.id} className="flex justify-between">
                              <span>{item.quantity} × {item.product_name}</span>
                              <span>KES {(item.quantity * item.unit_price_ksh).toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-muted-foreground border-t pt-1.5">
                            <span>Delivery</span>
                            <span>{order.shipping_fee_ksh > 0 ? `KES ${order.shipping_fee_ksh.toLocaleString()}` : "FREE"}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span>KES {order.total_ksh.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Paid</span>
                            <span className="text-success">KES {totalPaid.toLocaleString()}</span>
                          </div>
                        </div>

                        {order.order_shipping_details && (
                          <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                            {isPickup ? (
                              <p>Pickup order. Collect it from the seller.</p>
                            ) : (
                              <>
                                <p className="font-medium">Delivering to {order.order_shipping_details.recipient_name}</p>
                                <p className="text-muted-foreground">
                                  {order.order_shipping_details.address_line1}
                                  {order.order_shipping_details.city ? `, ${order.order_shipping_details.city}` : ""}
                                </p>
                              </>
                            )}
                            {vendorProfiles[order.vendor_id]?.whatsapp_number && (
                              <ContactVendorButton phoneNumber={vendorProfiles[order.vendor_id].whatsapp_number} className="mt-2" />
                            )}
                          </div>
                        )}

                        <TrackingTimeline orderId={order.id} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Dialog */}
      {selectedOrderForReview && (
        <OrderReviewDialog
          open={reviewDialogOpen}
          onClose={() => {
            setReviewDialogOpen(false);
            setSelectedOrderForReview(null);
          }}
          order={selectedOrderForReview}
          onReviewSubmitted={() => {
            // Mark this order as reviewed immediately
            if (selectedOrderForReview) {
              setReviewedOrders(prev => new Set(prev).add(selectedOrderForReview.id));
            }
            fetchOrders();
          }}
        />
      )}

      {/* Hidden Receipt Print Area */}
      {receiptOrder && (
        <div id="receipt-print-area" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <OrderReceipt order={receiptOrder} />
        </div>
      )}
    </div>
  );
};

export default Orders;
