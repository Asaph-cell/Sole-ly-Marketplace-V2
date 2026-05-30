/**
 * Notify Buyer Order Placed
 * 
 * Sends order confirmation email to buyer when order is successfully created.
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

        // Fetch order details
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select(`
                id,
                customer_id,
                total_ksh,
                order_items(product_name, quantity),
                order_shipping_details(recipient_name, email, delivery_type)
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

        const customerName = order.order_shipping_details?.recipient_name || "Customer";
        const itemsList = order.order_items
            ?.map((item: any) => `${item.quantity}x ${item.product_name}`)
            .join(", ") || "Items";

        const isPickup = order.order_shipping_details?.delivery_type === "pickup";

        const deliveryType = isPickup
            ? "Pickup from vendor"
            : "Home Delivery";

        // Send email
        const emailResult = await sendEmail({
            to: customerEmail,
            subject: `🎉 Order Confirmed - #${orderId.slice(0, 8)}`,
            html: emailTemplates.buyerOrderPlaced({
                customerName,
                orderId: orderId.slice(0, 8),
                items: itemsList,
                total: order.total_ksh,
                deliveryType,
                isPickup,
                orderTrackingUrl: `https://solelymarketplace.com/orders/${orderId}`,
            }),
        });

        console.log("Buyer order confirmation sent:", emailResult);

        // Store notification
        try {
            await supabase.from("notifications").insert({
                user_id: order.customer_id,
                type: "order_placed",
                title: "Order Confirmed",
                message: `Your order #${orderId.slice(0, 8)} has been placed successfully! Total: KES ${order.total_ksh.toLocaleString()}`,
                related_id: orderId,
            });
        } catch (notifError) {
            console.log("Could not store notification");
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Order confirmation sent",
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
