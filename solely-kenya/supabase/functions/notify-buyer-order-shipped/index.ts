/**
 * Notify Buyer Order Shipped
 * 
 * Sends email to buyer when vendor marks order as shipped with tracking info.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();
        const { orderId } = body;

        if (!orderId) {
            return new Response(
                JSON.stringify({ error: "Missing orderId" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch order with shipping details
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select(`
                id,
                customer_id,
                vendor_id,
                delivery_otp,
                order_items(product_name, quantity),
                order_shipping_details(recipient_name, email, courier_name, tracking_number, delivery_notes)
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

        // Get customer email
        let customerEmail = order.order_shipping_details?.email;
        if (!customerEmail && order.customer_id) {
            const { data: customerAuth } = await supabase.auth.admin.getUserById(order.customer_id);
            customerEmail = customerAuth?.user?.email;
        }

        if (!customerEmail) {
            return new Response(
                JSON.stringify({ success: true, message: "No customer email available", emailSent: false }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get vendor name
        const { data: vendor } = await supabase
            .from("profiles")
            .select("store_name")
            .eq("id", order.vendor_id)
            .single();

        const vendorName = vendor?.store_name || "The vendor";
        const customerName = order.order_shipping_details?.recipient_name || "Customer";
        const itemsList = order.order_items
            ?.map((item: any) => `${item.quantity}x ${item.product_name}`)
            .join(", ") || "Items";

        const courierName = order.order_shipping_details?.courier_name || "Courier";
        const trackingNumber = order.order_shipping_details?.tracking_number || "N/A";
        const deliveryNotes = order.order_shipping_details?.delivery_notes || "";

        // Send email with OTP
        const emailResult = await sendEmail({
            to: customerEmail,
            subject: `🚚 Order #${orderId.slice(0, 8)} Has Shipped! ${order.delivery_otp ? '(Delivery Code Inside)' : ''}`,
            html: emailTemplates.buyerOrderShipped({
                customerName,
                orderId: orderId.slice(0, 8),
                items: itemsList,
                vendorName,
                courierName,
                trackingNumber,
                deliveryNotes,
                orderTrackingUrl: `https://solelymarketplace.com/orders/${orderId}`,
                deliveryOtp: order.delivery_otp || undefined,
            }),
        });

        console.log("Buyer shipment notification sent:", emailResult);

        // Store notification
        try {
            await supabase.from("notifications").insert({
                user_id: order.customer_id,
                type: "order_shipped",
                title: "Order Shipped",
                message: `Your order #${orderId.slice(0, 8)} has been shipped! Tracking: ${trackingNumber}`,
                related_id: orderId,
            });
        } catch (notifError) {
            console.log("Could not store notification");
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Buyer shipment notification sent",
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
