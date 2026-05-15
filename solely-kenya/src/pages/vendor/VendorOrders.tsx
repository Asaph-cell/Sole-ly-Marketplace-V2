import { useEffect, useMemo, useState, useRef } from "react";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { clearAppBadge } from "@/lib/badge";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LocationViewMap } from "@/components/LocationViewMap";
import { DeliveryTrackingControl } from "@/components/DeliveryTrackingControl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type OrderRecord = Tables<"orders"> & {
  order_items: Tables<"order_items">[];
  order_shipping_details: Tables<"order_shipping_details"> | null;
  payments?: Array<{
    id: string;
    status: string;
    amount_ksh: number;
    metadata?: { is_delivery_fee?: boolean };
  }>;
};

const statusColors: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  pending_vendor_confirmation: "secondary",
  accepted: "default",
  arrived: "default",
  delivered: "default",
  completed: "default",
  disputed: "destructive",
  refunded: "destructive",
  cancelled_by_vendor: "outline",
  cancelled_by_customer: "outline",
};

const VendorOrders = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [shippingNotes, setShippingNotes] = useState<Record<string, { courier: string; tracking: string; notes: string }>>({});
  const [personalDelivery, setPersonalDelivery] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderToDecline, setOrderToDecline] = useState<OrderRecord | null>(null);
  const [declineReason, setDeclineReason] = useState<string>("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const shippingFormRef = useRef<HTMLDivElement>(null);

  // OTP-related state
  const [otpDialogOrder, setOtpDialogOrder] = useState<OrderRecord | null>(null);
  const [otpInput, setOtpInput] = useState<string>("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [showGeneratedOtp, setShowGeneratedOtp] = useState(false);
  const [sortBy, setSortBy] = useState<string>("newest");

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
          order_shipping_details(*)`
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
        // Hide cancelled orders and abandoned checkouts (buyer never paid — vendor was never involved)
        const isHidden = [
          "cancelled_by_vendor",
          "cancelled_by_customer",
          "pending_payment",
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

  // Helper function to check if delivery fee payment is pending
  // With zone-based pricing, delivery is pre-paid, so this checks if order total is paid
  const hasPendingDeliveryFee = (order: OrderRecord): boolean => {
    if (!order.payments || order.payments.length === 0) return false;
    const isPickup = order.order_shipping_details?.delivery_type === "pickup";
    if (isPickup) return false;

    // Check if total has been paid
    const totalPaid = getTotalPaid(order);
    return totalPaid < order.total_ksh;
  };

  // Helper function to calculate total paid
  const getTotalPaid = (order: OrderRecord): number => {
    if (!order.payments) return 0;
    return order.payments
      .filter((p) => p.status === "captured")
      .reduce((sum, p) => sum + Number(p.amount_ksh), 0);
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

  const updateOrderStatus = async (orderId: string, patch: Partial<Tables<"orders">>) => {
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) throw error;
    await loadOrders();
  };

  // Helper to check if order is expired (48 hours passed)
  const isOrderExpired = (order: OrderRecord): boolean => {
    const hoursSinceOrder = differenceInHours(new Date(), new Date(order.created_at));
    return hoursSinceOrder >= 48;
  };

  const handleAccept = async (order: OrderRecord) => {
    // Validate order status
    if (order.status !== "pending_vendor_confirmation") {
      toast.error("This order cannot be accepted. It may have already been processed.");
      return;
    }

    // Check if order has expired (48 hours passed)
    if (isOrderExpired(order)) {
      toast.error("This order has expired. It will be automatically cancelled and refunded to the buyer.");
      return;
    }

    // With zone-based pricing, delivery fee is already included in total
    // No need for vendor to set delivery charges

    setSaving(true);
    try {
      // Get existing payment to check if it's already captured
      const { data: existingPayment, error: paymentQueryError } = await supabase
        .from("payments")
        .select("id, gateway, status, amount_ksh")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (paymentQueryError) {
        console.error("Error fetching payment:", paymentQueryError);
        toast.error("Failed to verify payment status. Please try again.");
        return;
      }

      if (!existingPayment) {
        toast.error("No payment found for this order. Cannot accept order.");
        return;
      }

      // With zone-based pricing, totals are already calculated at checkout
      // No need to recalculate - just verify payment and accept
      const currentTotal = order.total_ksh;
      const currentShippingFee = order.shipping_fee_ksh;
      const currentCommission = order.commission_amount;
      const currentPayout = order.payout_amount;

      // Verify order status hasn't changed (race condition check)
      const { data: currentOrder, error: orderCheckError } = await supabase
        .from("orders")
        .select("status")
        .eq("id", order.id)
        .single();

      if (orderCheckError || !currentOrder) {
        toast.error("Failed to verify order status. Please refresh and try again.");
        return;
      }

      if (currentOrder.status !== "pending_vendor_confirmation") {
        toast.error("Order status has changed. Please refresh the page.");
        await loadOrders();
        return;
      }

      // Update order status to accepted (totals already set at checkout)
      await updateOrderStatus(order.id, {
        status: "accepted",
        accepted_at: new Date().toISOString(),
      });

      // Notify buyer about order acceptance (non-blocking)
      supabase.functions.invoke("notify-buyer-order-accepted", {
        body: { orderId: order.id },
      }).catch(err => console.log("Buyer acceptance notification failed (non-critical):", err));

      // Update or create escrow transaction
      const { data: existingEscrow, error: escrowCheckError } = await supabase
        .from("escrow_transactions")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle();

      if (escrowCheckError) {
        console.error("Error checking escrow:", escrowCheckError);
      } else if (existingEscrow) {
        // Escrow already exists, no update needed
        console.log("Escrow already exists for order:", order.id);
      } else {
        // Create escrow if it doesn't exist
        const { error: escrowCreateError } = await supabase
          .from("escrow_transactions")
          .insert({
            order_id: order.id,
            payment_id: existingPayment.id,
            status: "held",
            held_amount: currentTotal,
            commission_amount: currentCommission,
            release_amount: currentPayout,
          });

        if (escrowCreateError) {
          console.error("Failed to create escrow:", escrowCreateError);
          toast.warning("Order accepted, but escrow creation failed. Please contact support.");
        }
      }

      // Show success message and expand shipping section
      const isPickup = order.order_shipping_details?.delivery_type === "pickup";
      if (isPickup) {
        toast.success("Pickup order accepted. Customer will collect from your location.");
      } else {
        toast.success(`Order accepted! Now fill in shipping details below.`);
      }

      // Auto-expand and scroll to shipping form
      setExpandedOrderId(order.id);
      setTimeout(() => {
        shippingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (error) {
      console.error("Error accepting order:", error);
      toast.error("Failed to accept order. Please try again or contact support.");
    } finally {
      setSaving(false);
    }
  };

  // Confirm and process decline with refund
  const handleDecline = async (order: OrderRecord) => {
    setSaving(true);
    try {
      // Update order status
      await updateOrderStatus(order.id, {
        status: "cancelled_by_vendor",
        cancelled_at: new Date().toISOString(),
      });

      // Update escrow to released/refunded status
      const { error: escrowError } = await supabase
        .from("escrow_transactions")
        .update({
          status: "released",
          released_at: new Date().toISOString(),
        })
        .eq("order_id", order.id);

      if (escrowError) {
        console.warn("Escrow update warning:", escrowError);
      }

      // Notify buyer about the decline and refund (non-blocking)
      supabase.functions.invoke("notify-buyer-order-declined", {
        body: {
          orderId: order.id,
          reason: declineReason,
          isAutoDeclined: false,
        },
      }).catch(err => console.log("Buyer notification failed (non-critical):", err));

      toast.success("Order cancelled. Customer will be refunded and notified via email.");
      setOrderToDecline(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel order");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkShipped = async (order: OrderRecord) => {
    const shipping = shippingNotes[order.id] ?? { courier: "", tracking: "", notes: "" };
    const isPickup = order.order_shipping_details?.delivery_type === "pickup";
    const isPersonal = personalDelivery[order.id] ?? false;
    const isMarkingAsArrived = order.status === "shipped";

    // Validate courier details only if it's NOT a pickup and NOT a personal delivery
    // And only when initially marking as shipped (not when confirming arrival)
    if (!isPickup && !isPersonal && !isMarkingAsArrived) {
      if (!shipping.courier || !shipping.tracking) {
        toast.error("Provide courier name and tracking number");
        return;
      }
    }

    // Check payment if attempting to ship
    if (!isPickup && order.shipping_fee_ksh > 0 && !isMarkingAsArrived) {
      // Check for pending delivery fee payments
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("id, status, amount_ksh, metadata")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true });

      if (paymentsError) {
        toast.error("Failed to verify payment status");
        return;
      }

      // Calculate total paid amount
      const totalPaid = payments
        ?.filter((p) => p.status === "captured")
        .reduce((sum, p) => sum + Number(p.amount_ksh), 0) || 0;

      // Check if delivery fee payment is pending
      const hasPendingDeliveryFee = payments?.some(
        (p) => p.metadata?.is_delivery_fee === true && p.status !== "captured"
      );

      if (hasPendingDeliveryFee) {
        toast.error("Cannot ship order. Delivery fee payment is still pending.");
        return;
      }

      // Verify total paid matches order total
      if (totalPaid < order.total_ksh) {
        const remaining = order.total_ksh - totalPaid;
        toast.error(`Cannot ship order. Payment incomplete. Remaining amount: KES ${remaining.toLocaleString()}`);
        return;
      }
    }

    setSaving(true);
    const now = new Date();

    // Determine next status and fields to update
    let updates: Partial<Tables<"orders">> = {};
    let shippingUpdates: Partial<Tables<"order_shipping_details">> = {};
    let notificationType = "";
    let successMsg = "";

    if (isPickup) {
      // Pickup Logic: Accepted -> Arrived (Ready for Pickup)
      updates = {
        status: "arrived",
        vendor_confirmed: true,
        shipped_at: now.toISOString(), // reuse shipped_at for "ready at" time
        // No auto-release timer for pickup
      };
      // Courier details for pickup
      shippingUpdates = {
        courier_name: "Customer Pickup",
        tracking_number: "N/A",
        delivery_notes: shipping.notes || order.order_shipping_details?.delivery_notes || null,
      }
      notificationType = "notify-buyer-pickup-ready"; // Use specific pickup ready notification
      successMsg = "Order ready for pickup! Notification sent to buyer.";
    } else {
      // Delivery Logic
      if (order.status === "accepted") {
        // Step 1: Accepted -> Shipped (In Transit)
        let courierName = shipping.courier;
        let trackingNumber = shipping.tracking;

        if (isPersonal) {
          courierName = "Personal Delivery (Vendor)";
          trackingNumber = "Self-Delivered";
        }

        updates = {
          status: "shipped", // NEW STATUS
          shipped_at: now.toISOString(),
        };

        shippingUpdates = {
          courier_name: courierName,
          tracking_number: trackingNumber,
          delivery_notes: shipping.notes || order.order_shipping_details?.delivery_notes || null,
        };

        notificationType = "notify-buyer-order-shipped";
        successMsg = "Order marked as Shipped! Buyer notified it's on the way.";
      } else if (order.status === "shipped") {
        // Step 2: Shipped -> Arrived (Delivered)
        // 24 hours after marked arrived
        const autoRelease = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        updates = {
          status: "arrived",
          vendor_confirmed: true,
          auto_release_at: autoRelease.toISOString(),
          // delivered_at could be set here effectively
        };
        // No need to update shipping details again unless changed, but assume previous details hold
        notificationType = "notify-buyer-order-arrived"; // Need to ensure this exists or use generic
        successMsg = "Order marked as Arrived/Delivered. Buyer has 24 hours to verify.";
      }
    }

    try {
      if (Object.keys(shippingUpdates).length > 0) {
        const { error: shippingError } = await supabase
          .from("order_shipping_details")
          .update(shippingUpdates)
          .eq("order_id", order.id);

        if (shippingError) throw shippingError;
      }

      await updateOrderStatus(order.id, updates);

      // IMPORTANT: Generate OTP FIRST (before sending notification email)
      // This way the email will include the OTP code
      if (updates.status === "shipped" || (isPickup && updates.status === "arrived")) {
        await handleGenerateOtp(order.id, false);
      }

      // Notify buyer about shipment (non-blocking) - AFTER OTP is generated
      // The notification function will fetch the OTP from the database
      if (notificationType) {
        supabase.functions.invoke(notificationType, {
          body: { orderId: order.id },
        }).catch(err => console.log(`Notification ${notificationType} failed (non-critical):`, err));
      }

      toast.success(successMsg);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update shipment status");
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (orderId: string, field: "courier" | "tracking" | "notes", value: string) => {
    setShippingNotes((prev) => ({
      ...prev,
      [orderId]: {
        courier: prev[orderId]?.courier ?? "",
        tracking: prev[orderId]?.tracking ?? "",
        notes: prev[orderId]?.notes ?? "",
        [field]: value,
      },
    }));
  };

  // Generate OTP when marking as shipped/ready for pickup
  const handleGenerateOtp = async (orderId: string, isResend: boolean = false) => {
    try {
      setSaving(true);
      const { data, error } = await supabase.functions.invoke('generate-delivery-otp', {
        body: { orderId, isResend }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to generate OTP');

      // Show confirmation to vendor (OTP is NOT shown - only buyer sees it)
      setShowGeneratedOtp(true);

      // If resending, also trigger the email notification
      if (isResend) {
        // Fetch order to determine notification type
        const order = orders.find(o => o.id === orderId);
        if (order) {
          const isPickup = (order.order_shipping_details as any)?.delivery_type === "pickup";
          const notificationType = isPickup ? "notify-buyer-pickup-ready" : "notify-buyer-order-shipped";

          // Send the notification email with the new OTP
          supabase.functions.invoke(notificationType, {
            body: { orderId }
          }).catch(err => console.log(`Resend notification failed (non-critical):`, err));
        }
        toast.success("New code sent to buyer! Previous code is now invalid.");
      } else {
        toast.success("Delivery code generated and sent to buyer!");
      }

      await loadOrders();
    } catch (error) {
      console.error("Error generating OTP:", error);
      toast.error("Failed to generate delivery code. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Verify OTP entered by vendor (collected from buyer)
  const handleVerifyOtp = async () => {
    if (!otpDialogOrder || !otpInput) return;

    // Validate 6 digits
    if (!/^\d{6}$/.test(otpInput)) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    try {
      setOtpVerifying(true);
      const { data, error } = await supabase.functions.invoke('verify-delivery-otp', {
        body: { orderId: otpDialogOrder.id, otp: otpInput }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Delivery confirmed! KES ${data.payoutAmount?.toLocaleString() || ''} released to your account.`);
        setOtpDialogOrder(null);
        setOtpInput("");
        await loadOrders();
      } else {
        toast.error(data?.error || "Invalid code. Please check and try again.");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast.error("Failed to verify code. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Status helpers ──────────────────────────────────────────────────────────
  const STATUS_PILL: Record<string, string> = {
    pending_vendor_confirmation: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    accepted:   "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    shipped:    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    arrived:    "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    completed:  "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    disputed:   "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    refunded:   "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };
  const STATUS_LABEL_MAP: Record<string, string> = {
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
                    ? <span className="text-amber-600 font-semibold">{pendingOrders.length} need{pendingOrders.length === 1 ? "s" : ""} action</span>
                    : "All caught up ✓"}
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
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-2xl">📦</div>
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
                  <div key={order.id} className={`bg-card rounded-2xl border ${isPending && !isExpired ? "border-amber-300 dark:border-amber-700" : "border-border"}`}>

                    {/* Collapsed header — tap to expand */}
                    <button className="w-full text-left px-4 py-3.5 flex items-start gap-3"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                      <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        isPending && !isExpired ? "bg-amber-500 animate-pulse" :
                        isExpired ? "bg-muted-foreground" :
                        order.status === "completed" ? "bg-green-500" :
                        order.status === "shipped" ? "bg-purple-500" :
                        order.status === "disputed" ? "bg-red-500" : "bg-blue-400"}`} />
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
                      <span className="text-muted-foreground text-xs mt-1">{isExpanded ? "▲" : "▼"}</span>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

                        {/* Items, financials & delivery — hidden for missed orders */}
                        {!isExpired && (<>

                        {/* Items */}
                        <div className="space-y-1">
                          {order.order_items?.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.quantity} × {item.product_name}
                                {item.size && <span className="text-muted-foreground ml-1">(Size {item.size})</span>}
                                {item.color && <span className="text-muted-foreground ml-1">({item.color})</span>}
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
                          <div className="flex justify-between text-green-700 dark:text-green-400 font-semibold"><span>Your payout</span><span>KES {order.payout_amount.toLocaleString()}</span></div>
                        </div>

                        {/* Delivery info */}
                        <div className="bg-muted/40 rounded-xl p-3 text-xs space-y-1">
                          <p className="font-semibold text-sm mb-1">{isPickup ? "Pickup Info" : "Delivery Info"}</p>
                          {order.status === "completed" ? (
                            <p className="text-muted-foreground">✅ Completed — customer details hidden for privacy.</p>
                          ) : order.order_shipping_details ? (
                            <>
                              <p><span className="text-muted-foreground">Recipient: </span>{order.order_shipping_details.recipient_name}</p>
                              <p><span className="text-muted-foreground">Phone: </span>{order.order_shipping_details.phone}</p>
                              {isPickup ? (
                                <p className="text-green-700 dark:text-green-400 font-medium mt-1">Customer collects from your location.</p>
                              ) : (
                                <>
                                  <p><span className="text-muted-foreground">Address: </span>{order.order_shipping_details.address_line1}{order.order_shipping_details.city ? `, ${order.order_shipping_details.city}` : ""}</p>
                                  {order.order_shipping_details.delivery_notes && (
                                    <p className="text-blue-700 dark:text-blue-400 mt-1"><span className="font-medium">Note: </span>{order.order_shipping_details.delivery_notes}</p>
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
                                  <p className="text-muted-foreground mt-1">💰 Delivery fee KES {order.shipping_fee_ksh.toLocaleString()} included in your payout — arrange delivery yourself.</p>
                                </>
                              )}
                            </>
                          ) : null}
                        </div>

                        </>)}

                        {/* PENDING: Accept / Decline / Expired */}
                        {order.status === "pending_vendor_confirmation" && (
                          isOrderExpired(order) ? (
                            // Order is older than 48 hours — auto-refund already triggered
                            <div className="rounded-xl border border-muted bg-muted/50 p-4 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-base">⏰</span>
                                <p className="text-sm font-semibold text-muted-foreground">Missed Order — Refund Processed</p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                This order wasn't accepted within 48 hours. The buyer has been automatically refunded and notified.
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">New Order Request</p>
                                {(() => {
                                  const h = differenceInHours(new Date(), new Date(order.created_at));
                                  return h >= 24 && <Badge variant="destructive" className="text-xs">⏰ {Math.max(0, 48-h)}h left</Badge>;
                                })()}
                              </div>
                              <p className="text-xs text-amber-700 dark:text-amber-400">Delivery fee is already included. Review and respond.</p>
                              <div className="flex gap-2">
                                <Button className="flex-1 h-10 text-sm" onClick={() => handleAccept(order)} disabled={saving}>
                                  {saving ? "Accepting…" : "Accept"}
                                </Button>
                                <Button variant="outline" className="flex-1 h-10 text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
                                  onClick={() => { setDeclineReason(""); setOrderToDecline(order); }} disabled={saving}>
                                  Can't Fulfill
                                </Button>
                              </div>
                            </div>
                          )
                        )}

                        {/* ACCEPTED: Ship form */}
                        {order.status === "accepted" && (
                          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-4" ref={expandedOrderId === order.id ? shippingFormRef : null}>
                            {hasPendingDeliveryFee(order) && (
                              <p className="text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-2 border border-yellow-200 dark:border-yellow-800">
                                ⚠️ Delivery fee pending — paid KES {getTotalPaid(order).toLocaleString()} / KES {order.total_ksh.toLocaleString()}
                              </p>
                            )}
                            <p className="text-sm font-semibold">{isPickup ? "Mark Ready for Pickup" : "Ship the Order"}</p>
                            {!isPickup && (
                              <>
                                <div className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" id={`pd-${order.id}`} className="h-4 w-4 rounded"
                                    checked={personalDelivery[order.id] ?? false}
                                    onChange={e => setPersonalDelivery(prev => ({ ...prev, [order.id]: e.target.checked }))} />
                                  <Label htmlFor={`pd-${order.id}`} className="cursor-pointer">I'll deliver this myself</Label>
                                </div>
                                {!(personalDelivery[order.id] ?? false) && (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label htmlFor={`courier-${order.id}`} className="text-xs">Courier</Label>
                                      <Input id={`courier-${order.id}`} placeholder="e.g. DHL, G4S" className="h-9 text-sm"
                                        value={shippingNotes[order.id]?.courier ?? ""}
                                        onChange={e => handleFieldChange(order.id, "courier", e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor={`tracking-${order.id}`} className="text-xs">Tracking #</Label>
                                      <Input id={`tracking-${order.id}`} placeholder="Tracking number" className="h-9 text-sm"
                                        value={shippingNotes[order.id]?.tracking ?? ""}
                                        onChange={e => handleFieldChange(order.id, "tracking", e.target.value)} />
                                    </div>
                                  </div>
                                )}
                                {(personalDelivery[order.id] ?? false) && (
                                  <DeliveryTrackingControl orderId={order.id}
                                    isCurrentlyTracking={order.order_shipping_details?.delivery_tracking_enabled || false} />
                                )}
                              </>
                            )}
                            <div className="space-y-1">
                              <Label htmlFor={`notes-${order.id}`} className="text-xs">Notes (optional)</Label>
                              <Textarea id={`notes-${order.id}`} className="text-sm resize-none"
                                placeholder={isPickup ? "e.g. 'Ready at front desk'" : "Details for the buyer"}
                                value={shippingNotes[order.id]?.notes ?? ""}
                                onChange={e => handleFieldChange(order.id, "notes", e.target.value)} />
                            </div>
                            <Button className="w-full h-10 text-sm" onClick={() => handleMarkShipped(order)}
                              disabled={saving || hasPendingDeliveryFee(order)}>
                              {saving ? "Updating…" : isPickup ? "Mark Ready for Pickup" : "Mark as Shipped"}
                            </Button>
                          </div>
                        )}

                        {/* SHIPPED */}
                        {order.status === "shipped" && (
                          <div className="rounded-xl border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/20 p-4 space-y-3">
                            <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                              📦 In Transit
                              {order.shipped_at && <span className="font-normal text-xs ml-2 opacity-70">· shipped {formatDistanceToNow(new Date(order.shipped_at), { addSuffix: true })}</span>}
                            </p>
                            {order.order_shipping_details?.courier_name && <p className="text-xs text-muted-foreground">Courier: {order.order_shipping_details.courier_name}</p>}
                            <p className="text-xs text-purple-700 dark:text-purple-400">Ask the buyer for their 6-digit code when you hand over the item.</p>
                            <div className="flex gap-2">
                              <Button className="flex-1 h-9 text-sm" onClick={() => { setOtpDialogOrder(order); setOtpInput(""); }}>Enter Code</Button>
                              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => handleGenerateOtp(order.id, true)} disabled={saving}>Resend Code</Button>
                            </div>
                          </div>
                        )}

                        {/* ARRIVED */}
                        {order.status === "arrived" && (
                          <div className="rounded-xl border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/20 p-4 space-y-3">
                            <p className="text-sm font-semibold text-teal-800 dark:text-teal-300">
                              {isPickup ? "📍 Ready for Pickup" : "✅ Delivered"}
                            </p>
                            <p className="text-xs text-teal-700 dark:text-teal-400">
                              {isPickup ? "Ask the buyer for their 6-digit code when they collect." : "Enter the buyer's code to confirm delivery and release funds."}
                            </p>
                            <div className="flex gap-2">
                              <Button className="flex-1 h-9 text-sm" onClick={() => { setOtpDialogOrder(order); setOtpInput(""); }}>Enter Code</Button>
                              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => handleGenerateOtp(order.id, true)} disabled={saving}>Resend Code</Button>
                            </div>
                          </div>
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

      {/* Decline Dialog */}
      <AlertDialog open={!!orderToDecline} onOpenChange={(open) => { if (!open) { setOrderToDecline(null); setDeclineReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Can't Fulfill This Order?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Cancelling order <strong>#{orderToDecline?.id.slice(0, 8)}</strong>.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Reason:</label>
                  <select className="w-full p-2 border rounded-md bg-background text-foreground text-sm"
                    value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}>
                    <option value="">Select a reason…</option>
                    <option value="out_of_stock">Out of stock</option>
                    <option value="wrong_size">Size not available</option>
                    <option value="pricing_error">Pricing error</option>
                    <option value="cannot_deliver">Can't deliver to location</option>
                    <option value="damaged_item">Item damaged</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <p className="text-sm font-medium">Full refund of KES {orderToDecline?.total_ksh.toLocaleString()} will be processed.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:gap-3 mt-2">
            <AlertDialogCancel disabled={saving} className="flex-1 mt-0" onClick={() => { setOrderToDecline(null); setDeclineReason(""); }}>
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => orderToDecline && handleDecline(orderToDecline)}
              disabled={saving || !declineReason}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Processing…" : "Can't Fulfill"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OTP Entry Dialog */}
      <AlertDialog open={!!otpDialogOrder} onOpenChange={(open) => { if (!open) { setOtpDialogOrder(null); setOtpInput(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🔐 Enter Buyer's Delivery Code</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>6-digit code for order <strong>#{otpDialogOrder?.id.slice(0, 8)}</strong>.</p>
                <Input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  placeholder="• • • • • •" value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-[0.5em] font-mono h-14" autoFocus />
                <p className="text-xs text-muted-foreground">Funds release to your wallet immediately after verification.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 mt-4">
            <AlertDialogCancel disabled={otpVerifying} className="flex-1 mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleVerifyOtp(); }}
              disabled={otpVerifying || otpInput.length !== 6} className="flex-1">
              {otpVerifying ? "Verifying…" : "Confirm Delivery"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* OTP Generated Dialog */}
      <AlertDialog open={showGeneratedOtp} onOpenChange={setShowGeneratedOtp}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>✅ Delivery Code Sent to Buyer</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>A 6-digit code was sent to the buyer via email and is on their Orders page.</p>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-100">
                  🔐 When you hand over the item, ask the buyer for their code and enter it to release your payment.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end mt-4">
            <AlertDialogAction onClick={() => setShowGeneratedOtp(false)}>Got it!</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VendorOrders;

