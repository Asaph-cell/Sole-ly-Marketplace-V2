// Supabase actions for the chatbot (order tracking, etc.)
import { supabase } from "@/integrations/supabase/client";

interface TrackOrderResult {
  found: boolean;
  message: string;
}

const STATUS_MAP: Record<string, { emoji: string; label: string }> = {
  pending_payment: { emoji: "⏳", label: "Awaiting payment" },
  pending: { emoji: "📦", label: "Order placed, waiting for vendor" },
  accepted: { emoji: "📦", label: "Vendor accepted, preparing your order" },
  dispatched: { emoji: "🚚", label: "On the way!" },
  shipped: { emoji: "🚚", label: "On the way!" },
  completed: { emoji: "✅", label: "Delivered" },
  delivered: { emoji: "✅", label: "Delivered" },
  arrived: { emoji: "✅", label: "Arrived" },
  cancelled: { emoji: "❌", label: "Cancelled" },
  refunded: { emoji: "💸", label: "Refunded" },
  declined: { emoji: "❌", label: "Declined by vendor" },
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
    const statusInfo = STATUS_MAP[status] || { emoji: "❓", label: status };
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
      `${statusInfo.emoji} **${statusInfo.label}**`,
      "",
      totalKsh ? `💰 Total: ${totalKsh}` : "",
      `🏪 Vendor: ${vendorName}`,
      createdDate ? `📅 Ordered: ${createdDate}` : "",
      "",
      status === "dispatched" || status === "shipped"
        ? "📍 Check your Orders page for live tracking!"
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
