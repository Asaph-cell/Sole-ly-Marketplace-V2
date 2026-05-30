import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisputeChat } from "@/components/disputes/DisputeChat";
import { toast } from "sonner";
import { OrderReviewDialog } from "@/components/OrderReviewDialog";
import { OrderConfirmationModal } from "@/components/OrderConfirmationModal";
import { OrderReceipt } from "@/components/OrderReceipt";
import { LiveDeliveryTracker } from "@/components/LiveDeliveryTracker";
import { TrackingTimeline } from "@/components/tracking/TrackingTimeline";
import { Phone, MessageCircle, PhoneCall, CheckCircle, Download } from "lucide-react";
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
  pending_vendor_confirmation: { label: "Awaiting vendor", variant: "secondary" },
  accepted: { label: "Vendor accepted", variant: "default" },
  shipped: { label: "In Transit", variant: "default" },
  arrived: { label: "Arrived", variant: "default" },
  delivered: { label: "Delivered", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  disputed: { label: "In dispute", variant: "destructive" },
  refunded: { label: "Refunded", variant: "outline" },
  cancelled_by_vendor: { label: "Declined by Vendor", variant: "destructive" },
  cancelled_by_customer: { label: "Cancelled", variant: "outline" },
};


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
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [selectedOrderForConfirmation, setSelectedOrderForConfirmation] = useState<OrderRecord | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());

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
          toast.success('Payment confirmed! Your order is being processed.');
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
        .from("profiles")
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
            // We can't filter by order customer_id directly on payments table
            // But we can listen to general payment events and rely on fetchOrders to filter
            // Or use a more specific filter if possible. 
            // For now, refreshing on any visible payment change is acceptable for this user scope.
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

  // Open confirmation modal instead of direct action
  const handleConfirmDelivery = (order: OrderRecord) => {
    setSelectedOrderForConfirmation(order);
    setConfirmationModalOpen(true);
  };

  const handleConfirmationSuccess = () => {
    // Send thank you email (non-blocking)
    if (selectedOrderForConfirmation) {
      supabase.functions.invoke("notify-buyer-order-completed", {
        body: { orderId: selectedOrderForConfirmation.id },
      }).catch(err => console.log("Order completion email failed (non-critical):", err));
    }

    setConfirmationModalOpen(false);
    setSelectedOrderForConfirmation(null);
    fetchOrders();
  };

  const handleOpenDispute = async (order: OrderRecord) => {
    const description = window.prompt("Describe the issue (required)");
    if (!description) return;

    try {
      const { error } = await supabase.from("disputes").insert({
        order_id: order.id,
        customer_id: order.customer_id,
        vendor_id: order.vendor_id,
        reason: "other",
        description,
      });

      if (error) throw error;

      await supabase.from("orders").update({ status: "disputed" }).eq("id", order.id);

      // Notify vendor and buyer
      const { data: disputeData } = await supabase
        .from("disputes")
        .select("id")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (disputeData) {
        supabase.functions.invoke("notify-dispute-filed", {
          body: { disputeId: disputeData.id },
        });
      }

      toast.success("Dispute submitted. Solely support will reach out.");
      fetchOrders();
    } catch (error) {
      console.error("Failed to open dispute", error);
      toast.error("Could not open dispute");
    }
  };

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

  // Helper to check if order has pending/failed payment and needs retry
  const needsPaymentRetry = (order: OrderRecord): boolean => {
    const totalPaid = order.payments
      ?.filter((p: any) => p.status === 'captured' || p.status === 'completed')
      .reduce((sum: number, p: any) => sum + Number(p.amount_ksh), 0) || 0;
    return totalPaid < order.total_ksh;
  };

  const upcomingActions = useMemo(() => {
    return orders.filter((order) => {
      // For pickup, STRICTLY require vendor_confirmed (which is set when vendor marks as Ready)
      const isPickup = (order.order_shipping_details as any)?.delivery_type === "pickup";
      if (isPickup) {
        return order.status === "arrived" && order.vendor_confirmed && !order.buyer_confirmed;
      }
      return order.status === "arrived" && !order.buyer_confirmed;
    });
  }, [orders]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Orders</h1>
            <p className="text-muted-foreground">Track escrow-protected purchases and manage deliveries.</p>
          </div>
          <Button variant="ghost" onClick={fetchOrders} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {upcomingActions.length > 0 && (
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-primary text-lg">Awaiting your confirmation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {upcomingActions.map((order) => {
                const isPickup = (order.order_shipping_details as any)?.delivery_type === "pickup";
                return (
                  <div key={order.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>
                        {isPickup
                          ? `Order #${order.id.slice(0, 8)} is ready for pickup`
                          : `Order #${order.id.slice(0, 8)} arrived ${order.shipped_at ? formatDistanceToNow(new Date(order.shipped_at), { addSuffix: true }) : "recently"}`
                        }
                      </span>
                      <Button size="sm" onClick={() => handleConfirmDelivery(order)}>
                        {isPickup ? "I Have Collected My Shoes" : "I Have Received My Delivery"}
                      </Button>
                    </div>
                    {isPickup && (
                      <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                        👟 <strong>Important:</strong> Please go to the vendor's shop and collect your shoes first, then click "Confirm Pickup" once you have them in hand.
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

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

              const totalPaid = order.payments
                ?.filter((p: any) => p.status === 'captured' || p.status === 'completed')
                .reduce((sum: number, p: any) => sum + Number(p.amount_ksh), 0) || 0;
              const pendingAmount = order.total_ksh - totalPaid;
              const hasPendingBalance = pendingAmount > 1; // Tolerance for float errors

              // Override status display if payment is pending
              const displayStatus = hasPendingBalance
                ? { label: "Payment Pending", variant: "destructive" as const }
                : status;

              return (
                <Card key={order.id} className={isHighlighted ? "border-primary" : undefined}>
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Placed {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={displayStatus.variant}>{displayStatus.label}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      {order.order_items?.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>{item.quantity} × {item.product_name}</span>
                          <span>KES {(item.quantity * item.unit_price_ksh).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground border-t pt-2">
                      <span>Total Order Value</span>
                      <span className="font-semibold text-foreground">KES {order.total_ksh.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Paid</span>
                      <span className="font-semibold text-green-600">KES {totalPaid.toLocaleString()}</span>
                    </div>

                    {/* Payment Status Section */}
                    {hasPendingBalance ? (
                      <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800 space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Payment Required</Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-red-700 dark:text-red-400">Amount to pay</span>
                          <span className="text-red-700 dark:text-red-400 font-bold">KES {pendingAmount.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Your payment was not completed. Please ensure you have sufficient funds and retry.
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          variant="destructive"
                          onClick={() => handlePayDeliveryFee(order)}
                          disabled={processingPayment === order.id}
                        >
                          {processingPayment === order.id ? "Processing..." : "Retry Payment"}
                        </Button>
                      </div>
                    ) : order.status === "pending_vendor_confirmation" ? (
                      <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-green-600">Payment Complete</Badge>
                        </div>
                        <p className="text-sm text-green-700 dark:text-green-400 mt-2">
                          ✓ Payment received. Awaiting vendor confirmation.
                        </p>
                      </div>
                    ) : order.status === "cancelled_by_vendor" ? (
                      <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="destructive">Order Declined</Badge>
                        </div>
                        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                          The vendor has declined this order.
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          A full refund has been initiated. If you paid via M-Pesa, expect a reversal shortly.
                        </p>
                      </div>
                    ) : null}

                    {order.order_shipping_details && (
                      <div className="bg-muted rounded-lg p-4 text-sm">
                        {(order.order_shipping_details as any)?.delivery_type === "pickup" ? (
                          <>
                            <p className="font-medium mb-2">Pickup Order - {order.order_shipping_details.recipient_name}</p>
                            <p className="text-muted-foreground mb-3">
                              You will collect this order from the vendor's location. Contact the vendor to arrange pickup time.
                            </p>
                            {order.order_shipping_details.phone && (
                              <p className="mb-2 text-xs text-muted-foreground">Your contact: {order.order_shipping_details.phone}</p>
                            )}
                            {vendorProfiles[order.vendor_id]?.whatsapp_number && (
                              <ContactVendorButton phoneNumber={vendorProfiles[order.vendor_id].whatsapp_number} className="mt-2" />
                            )}
                          </>
                        ) : (
                          <>
                            <p className="font-medium mb-2">Shipping to {order.order_shipping_details.recipient_name}</p>
                            <p>{order.order_shipping_details.address_line1}</p>
                            {order.order_shipping_details.address_line2 && <p>{order.order_shipping_details.address_line2}</p>}
                            <p>
                              {order.order_shipping_details.city}
                              {(order.order_shipping_details as any)?.county ? `, ${(order.order_shipping_details as any).county}` : ""}
                            </p>
                            {order.order_shipping_details.delivery_notes && (
                              <p className="text-muted-foreground mt-2">Note: {order.order_shipping_details.delivery_notes}</p>
                            )}
                            {vendorProfiles[order.vendor_id]?.whatsapp_number && (
                              <ContactVendorButton phoneNumber={vendorProfiles[order.vendor_id].whatsapp_number} className="mt-3" />
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Live Delivery Tracking - Only show when order is shipped and tracking is active */}
                    {order.status === "shipped" && !isPickup && (
                      <LiveDeliveryTracker
                        orderId={order.id}
                        recipientName={order.order_shipping_details?.recipient_name || undefined}
                      />
                    )}

                    {/* Milestone Tracking Timeline */}
                    <TrackingTimeline orderId={order.id} />

                    {/* Dispute Chat */}
                    {order.status === "disputed" && (order as any).disputes?.[0] && (
                      <div className="mt-4">
                        <DisputeChat disputeId={(order as any).disputes[0].id} currentUserRole="buyer" />
                      </div>
                    )}

                    {/* Delivery OTP Display - Show to buyer when order is shipped or arrived */}
                    {(order.status === "shipped" || order.status === "arrived") && (order as any).delivery_otp && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">🔐</span>
                          <p className="font-semibold text-blue-900 dark:text-blue-100">Your Delivery Code</p>
                        </div>
                        <div className="bg-white dark:bg-background p-4 rounded-lg text-center">
                          <p className="text-3xl font-mono font-bold tracking-widest text-blue-900 dark:text-blue-100">
                            {(order as any).delivery_otp}
                          </p>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-3">
                          <strong>Important:</strong> Share this code with the vendor when they deliver your order.
                          This confirms you received your shoes and releases payment to the vendor.
                        </p>
                        {isPickup && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                            📍 Show this code to the vendor when you collect your order.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      {(order.status === "arrived" || order.status === "shipped") && !order.buyer_confirmed && (
                        // For pickup, ensure vendor has actually confirmed (marked as ready)
                        (!isPickup || order.vendor_confirmed) && (
                          <Button size="sm" onClick={() => handleConfirmDelivery(order)}>
                            {isPickup ? "I Have Collected My Shoes" : "I Have Received My Delivery"}
                          </Button>
                        )
                      )}
                      {order.status === "delivered" && !order.buyer_confirmed && (
                        <Button size="sm" onClick={() => handleConfirmDelivery(order)}>
                          {isPickup ? "I Have Collected My Shoes" : "I Have Received My Delivery"}
                        </Button>
                      )}
                      {order.status === "completed" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
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
                            }}
                          >
                            <Download size={16} strokeWidth={1.5} className=" mr-1" />
                            Download Receipt
                          </Button>
                          {reviewedOrders.has(order.id) ? (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                              <CheckCircle size={16} strokeWidth={1.5}  />
                              Thank you for your review!
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedOrderForReview(order);
                                setReviewDialogOpen(true);
                              }}
                            >
                              Leave Review
                            </Button>
                          )}
                        </>
                      )}
                      {order.status !== "disputed" && order.status !== "refunded" && order.status !== "completed" && (
                        <Button size="sm" variant="destructive" onClick={() => handleOpenDispute(order)}>
                          Report a problem
                        </Button>
                      )}
                    </div>
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

      {/* Order Confirmation Modal */}
      {selectedOrderForConfirmation && user && (
        <OrderConfirmationModal
          open={confirmationModalOpen}
          onClose={() => {
            setConfirmationModalOpen(false);
            setSelectedOrderForConfirmation(null);
          }}
          orderId={selectedOrderForConfirmation.id}
          vendorId={selectedOrderForConfirmation.vendor_id}
          customerId={user.id}
          onSuccess={handleConfirmationSuccess}
          isPickup={(selectedOrderForConfirmation.order_shipping_details as any)?.delivery_type === 'pickup'}
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


