/**
 * Notify Order Completed
 * 
 * Sends final receipt/completed emails to both buyer and vendor after OTP verification.
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
                vendor_id,
                total_ksh,
                payout_amount,
                order_items(product_name, quantity),
                order_shipping_details(recipient_name, email),
                vendor:vendor_id(full_name, store_name, email)
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

        // 1. Get Customer Email
        let customerEmail = order.order_shipping_details?.email;
        if (!customerEmail && order.customer_id) {
            const { data: customerAuth } = await supabase.auth.admin.getUserById(order.customer_id);
            customerEmail = customerAuth?.user?.email;
        }

        const customerName = order.order_shipping_details?.recipient_name || "Customer";
        const itemsList = order.order_items
            ?.map((item: any) => `${item.quantity}x ${item.product_name}`)
            .join(", ") || "Items";

        // 2. Get Vendor Email
        let vendorEmail = order.vendor?.email;
        if (!vendorEmail && order.vendor_id) {
             const { data: vendorAuth } = await supabase.auth.admin.getUserById(order.vendor_id);
             vendorEmail = vendorAuth?.user?.email;
        }
        
        const vendorName = order.vendor?.store_name || order.vendor?.full_name || "Vendor";
        const payoutAmount = order.payout_amount || (order.total_ksh * 0.94);

        const promises = [];

        // Notify Buyer
        if (customerEmail) {
            promises.push(
                sendEmail({
                    to: customerEmail,
                    subject: `✅ Order Completed & Receipt - #${orderId.slice(0, 8)}`,
                    html: emailTemplates.buyerOrderCompleted({
                        customerName,
                        orderId: orderId.slice(0, 8),
                        items: itemsList,
                        reviewUrl: `https://solelymarketplace.com/track/${orderId}`, // Can point to track page or dedicated review
                    }),
                })
            );
        }

        // Notify Vendor
        if (vendorEmail) {
            promises.push(
                sendEmail({
                    to: vendorEmail,
                    subject: `💰 Payment Released - Order #${orderId.slice(0, 8)}`,
                    html: emailTemplates.vendorPaymentReleased({
                        vendorName,
                        orderId: orderId.slice(0, 8),
                        payoutAmount,
                    }),
                })
            );
        }

        const results = await Promise.allSettled(promises);
        console.log("Completion emails sent:", results);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Order completion notifications processed",
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
