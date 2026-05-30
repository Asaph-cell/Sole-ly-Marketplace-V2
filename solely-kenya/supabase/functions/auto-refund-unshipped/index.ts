/**
 * Auto-Dispute Undelivered Orders
 * 
 * This scheduled Edge Function runs periodically to:
 * 1. Find orders confirmed by vendor but not marked "arrived" within 5 days
 * 2. Automatically raise a dispute for admin review
 * 3. Notify both buyer and vendor
 * 
 * Schedule: Run every hour via Supabase cron or external scheduler
 * 
 * Note: Unlike the old auto-refund, this creates a dispute for admin review
 * because the buyer might be okay with delayed delivery.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

        // Find orders that are:
        // 1. Status = vendor_confirmed, processing, or accepted (confirmed but not arrived)
        // 2. Confirmed more than 5 days ago
        const cutoffTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

        const { data: undeliveredOrders, error: fetchError } = await supabase
            .from("orders")
            .select(`
                id,
                vendor_id,
                customer_id,
                total_ksh,
                created_at,
                order_items(product_name, quantity),
                order_shipping_details(recipient_name, phone, email, delivery_type)
            `)
            .in("status", ["vendor_confirmed", "processing", "accepted", "pending_shipment", "confirmed"])
            .lt("created_at", cutoffTime);

        if (fetchError) {
            console.error("Error fetching undelivered orders:", fetchError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch undelivered orders" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!undeliveredOrders || undeliveredOrders.length === 0) {
            console.log("No undelivered orders to dispute");
            return new Response(
                JSON.stringify({ message: "No undelivered orders found", disputed: 0 }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Found ${undeliveredOrders.length} undelivered orders to auto-dispute`);

        const results = {
            disputed: 0,
            failed: 0,
            errors: [] as string[],
        };

        for (const order of undeliveredOrders) {
            try {
                // Skip pickup orders - they have no time limit
                const shippingDetails = order.order_shipping_details?.[0];
                if (shippingDetails?.delivery_type === 'pickup') {
                    console.log(`Skipping pickup order ${order.id} - no time limits for pickup`);
                    continue;
                }

                // 1. Update order status to disputed
                const { error: disputeUpdateError } = await supabase
                    .from("orders")
                    .update({
                        status: "disputed",
                        vendor_notes: "Auto-disputed: Order not marked as arrived within 5 days. Admin will follow up with vendor.",
                    })
                    .eq("id", order.id);

                if (disputeUpdateError) {
                    throw new Error(`Failed to update order status: ${disputeUpdateError.message}`);
                }

                // 2. Create a dispute record
                const { error: disputeError } = await supabase
                    .from("disputes")
                    .insert({
                        order_id: order.id,
                        raised_by: "system",
                        reason: "delivery_delay",
                        description: "Order was not marked as arrived within 5 days of confirmation. System auto-raised this dispute for admin review.",
                        status: "open",
                    });

                if (disputeError) {
                    console.warn(`Dispute record creation warning for order ${order.id}:`, disputeError);
                    // Continue anyway - order status is already updated
                }

                // 3. Notify customer about the dispute
                if (shippingDetails?.email) {
                    fetch(`${supabaseUrl}/functions/v1/send-email`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                        },
                        body: JSON.stringify({
                            to: shippingDetails.email,
                            subject: `Order #${order.id.slice(0, 8)} - Delivery Delay Investigation`,
                            html: `
                                <h2>Your Order is Under Review</h2>
                                <p>Dear ${shippingDetails.recipient_name || 'Customer'},</p>
                                <p>Your order has not been marked as delivered within our 5-day delivery window.</p>
                                <p>We have automatically raised this for admin review. Our team will contact the vendor to investigate the delay.</p>
                                <p>Your payment of <strong>KES ${order.total_ksh?.toLocaleString()}</strong> remains safely held in escrow until this is resolved.</p>
                                <p>If you have already received your order, please log in to Solely and confirm delivery.</p>
                                <p>If you have any concerns, please contact us at contact@solelymarketplace.com</p>
                                <p>Best regards,<br>Solely Marketplace</p>
                            `,
                        }),
                    }).catch(err => console.log(`Email notification failed for ${order.id}:`, err));
                }

                console.log(`Order ${order.id} auto-disputed for delivery delay`);
                results.disputed++;
            } catch (error) {
                console.error(`Failed to process order ${order.id}:`, error);
                results.failed++;
                results.errors.push(`Order ${order.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        }

        console.log(`Auto-dispute complete: ${results.disputed} disputed, ${results.failed} failed`);

        return new Response(
            JSON.stringify({
                message: "Auto-dispute job completed",
                ...results,
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
