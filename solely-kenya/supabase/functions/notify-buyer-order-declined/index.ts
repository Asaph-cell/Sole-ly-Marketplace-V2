/**
 * Notify Buyer Order Declined
 * 
 * This Edge Function is called when a vendor declines an order.
 * It sends an email notification to the buyer about the declined order and refund.
 * 
 * Called from:
 * 1. VendorOrders.tsx handleDecline
 * 2. auto-cancel-stale-orders for auto-declined orders
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();
        const { orderId, reason, isAutoDeclined } = body;

        if (!orderId) {
            return new Response(
                JSON.stringify({ error: "Missing orderId" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch order details with shipping, items, and vendor
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select(`
        id,
        total_ksh,
        vendor_id,
        customer_id,
        order_items(product_name, quantity),
        order_shipping_details(recipient_name, email, phone)
      `)
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            console.error("Order not found:", orderError);
            return new Response(
                JSON.stringify({ error: "Order not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get customer email from shipping details or auth
        let customerEmail = order.order_shipping_details?.email;
        if (!customerEmail && order.customer_id) {
            const { data: customerAuth } = await supabase.auth.admin.getUserById(order.customer_id);
            customerEmail = customerAuth?.user?.email;
        }

        if (!customerEmail) {
            console.log("No customer email found, skipping email notification");
            return new Response(
                JSON.stringify({ success: true, message: "No customer email available", emailSent: false }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get vendor business name
        const { data: vendor } = await supabase
            .from("profiles")
            .select("store_name")
            .eq("id", order.vendor_id)
            .single();

        const vendorName = vendor?.store_name || "The vendor";

        // Build items list
        const itemsList = order.order_items
            ?.map((item: any) => `${item.quantity}x ${item.product_name}`)
            .join(", ") || "Items";

        const customerName = order.order_shipping_details?.recipient_name || "Customer";

        // Send appropriate email based on whether it was auto-declined
        let emailResult;
        if (isAutoDeclined) {
            emailResult = await sendEmail({
                to: customerEmail,
                subject: `Order #${orderId.slice(0, 8)} - Automatically Cancelled`,
                html: emailTemplates.buyerOrderAutoDeclined({
                    customerName,
                    orderId: orderId.slice(0, 8),
                    items: itemsList,
                    total: order.total_ksh,
                }),
            });
        } else {
            emailResult = await sendEmail({
                to: customerEmail,
                subject: `Order #${orderId.slice(0, 8)} - Cancelled by Vendor`,
                html: emailTemplates.buyerOrderDeclined({
                    customerName,
                    orderId: orderId.slice(0, 8),
                    items: itemsList,
                    total: order.total_ksh,
                    vendorName,
                    reason,
                }),
            });
        }

        console.log("Buyer notification email sent:", emailResult);

        // Store notification if table exists
        try {
            await supabase.from("notifications").insert({
                user_id: order.customer_id,
                type: "order_declined",
                title: isAutoDeclined ? "Order Automatically Cancelled" : "Order Declined",
                message: `Your order #${orderId.slice(0, 8)} has been cancelled. A refund of KES ${order.total_ksh.toLocaleString()} will be processed.`,
                related_id: orderId,
                is_read: false,
            });
        } catch (notifError) {
            console.log("Could not store notification (table may not exist)");
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Buyer notification sent",
                emailSent: emailResult.success,
                orderId,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
