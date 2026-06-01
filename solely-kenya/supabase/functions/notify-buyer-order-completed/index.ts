/**
 * Notify Buyer Order Completed
 * 
 * Sends thank you email with review request when order is completed.
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

        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select(`
                id,
                customer_id,
                status,
                order_items(product_name, quantity),
                order_shipping_details(recipient_name, email)
            `)
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: "Order not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check if order actually has 'completed' status
        if (order.status !== 'completed') {
            return new Response(
                JSON.stringify({ success: true, message: `Order status is '${order.status}', not sending completion email`, emailSent: false }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check for active disputes - don't send completion email if disputed
        const { data: disputes } = await supabase
            .from("disputes")
            .select("id, status")
            .eq("order_id", orderId)
            .in("status", ["pending", "under_review"])
            .limit(1);

        if (disputes && disputes.length > 0) {
            console.log(`Order ${orderId} has active dispute, skipping completion email`);
            return new Response(
                JSON.stringify({ success: true, message: "Order has active dispute, skipping completion email", emailSent: false }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

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
        const itemsList = order.order_items?.map((item: any) => `${item.quantity}x ${item.product_name}`).join(", ") || "Items";
        const reviewUrl = `https://solelymarketplace.com/track/${orderId}`;

        const emailResult = await sendEmail({
            to: customerEmail,
            subject: `✅ Order Completed - Leave a Review! #${orderId.slice(0, 8)}`,
            html: emailTemplates.buyerOrderCompleted({
                customerName,
                orderId: orderId.slice(0, 8),
                items: itemsList,
                reviewUrl,
            }),
        });

        await supabase.from("notifications").insert({
            user_id: order.customer_id,
            type: "order_completed",
            title: "Order Completed",
            message: `Your order #${orderId.slice(0, 8)} is complete! Leave a review to help others.`,
            related_id: orderId,
        }).catch(() => { });

        return new Response(
            JSON.stringify({
                success: true,
                message: "Order completed notification sent",
                emailSent: emailResult.success,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
