// Supabase actions for the chatbot (order tracking, etc.)
import { supabase } from "@/integrations/supabase/client";

interface TrackOrderResult {
  found: boolean;
  message: string;
}

const STATUS_MAP: Record<string, { label: string }> = {
  pending_payment: { label: "Awaiting payment" },
  pending: { label: "Order placed, waiting for vendor" },
  accepted: { label: "Vendor accepted, preparing your order" },
  dispatched: { label: "On the way!" },
  shipped: { label: "On the way!" },
  completed: { label: "Delivered" },
  delivered: { label: "Delivered" },
  arrived: { label: "Arrived" },
  cancelled: { label: "Cancelled" },
  refunded: { label: "Refunded" },
  declined: { label: "Declined by vendor" },
};

export async function trackOrder(orderId: string): Promise<TrackOrderResult> {
  try {
    const trimmed = orderId.trim();
    if (!trimmed) {
      return { found: false, message: "Please enter a valid order ID." };
    }

    // Use the same RPC that GuestTracking uses, works without auth
    const { data, error } = await supabase.rpc("get_guest_order_details", {
      target_order_id: trimmed,
    });

    if (error || !data) {
      return { found: false, message: "" };
    }

    const order = data as any;
    const status = order.status || "pending";
    const statusInfo = STATUS_MAP[status] || { label: status };
    const vendorName =
      order.vendor?.store_name || order.vendor?.full_name || "Vendor";
    const totalKsh = order.total_amount
      ? `KES ${Number(order.total_amount).toLocaleString()}`
      : "";
    const createdDate = order.created_at
      ? new Date(order.created_at).toLocaleDateString("en-KE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

    const message = [
      `**${statusInfo.label}**`,
      "",
      totalKsh ? `Total: ${totalKsh}` : "",
      `Vendor: ${vendorName}`,
      createdDate ? `Ordered: ${createdDate}` : "",
      "",
      status === "dispatched" || status === "shipped"
        ? "Check your Orders page for live tracking."
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    return { found: true, message };
  } catch (err) {
    console.error("[ChatBot] trackOrder error:", err);
    return {
      found: false,
      message: "Something went wrong while looking up your order. Please try again.",
    };
  }
}
