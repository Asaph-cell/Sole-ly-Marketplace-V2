/**
 * Auto-Cancel Stale Orders
 * 
 * This scheduled Edge Function runs periodically to:
 * 1. Find orders pending_vendor_confirmation for > 48 hours
 * 2. Cancel them automatically
 * 3. Process IntaSend refund to customer
 * 4. Notify the customer (refund confirmation)
 * 5. Notify the vendor (missed order warning)
 * 
 * Schedule: Run every hour via Supabase cron or external scheduler
 * 
 * To set up cron in Supabase:
 * - Use pg_cron extension or external scheduler (GitHub Actions, etc.)
 * - Call: curl -X POST https://<project>.supabase.co/functions/v1/auto-cancel-stale-orders
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";
import { getPlatformSetting } from "../_shared/platform-settings.ts";

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
        // 1. Status = pending_vendor_confirmation
        // 2. Created more than `vendor_confirm_hours` ago (admin-editable,
        //    Admin > Settings > Time windows; defaults to 48)
        const vendorConfirmHours = await getPlatformSetting(supabase, "vendor_confirm_hours", 48);
        const cutoffTime = new Date(Date.now() - vendorConfirmHours * 60 * 60 * 1000).toISOString();

        const { data: staleOrders, error: fetchError } = await supabase
            .from("orders")
            .select(`
        id,
        vendor_id,
        customer_id,
        total_ksh,
        created_at,
        order_items(product_name, quantity),
        order_shipping_details(recipient_name, phone, email)
      `)
            .eq("status", "pending_vendor_confirmation")
            .lt("created_at", cutoffTime);

        if (fetchError) {
            console.error("Error fetching stale orders:", fetchError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch stale orders" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!staleOrders || staleOrders.length === 0) {
            console.log("No stale orders to cancel");
            return new Response(
                JSON.stringify({ message: "No stale orders found", cancelled: 0 }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Found ${staleOrders.length} stale orders to auto-cancel`);

        const results = {
            cancelled: 0,
            failed: 0,
            errors: [] as string[],
        };

        for (const order of staleOrders) {
            try {
                // 1. Cancel the order
                const { error: cancelError } = await supabase
                    .from("orders")
                    .update({
                        status: "cancelled_by_vendor",
                        cancelled_at: new Date().toISOString(),
                        vendor_notes: "Auto-cancelled: No vendor response within 48 hours",
                    })
                    .eq("id", order.id);

                if (cancelError) {
                    throw new Error(`Failed to cancel order: ${cancelError.message}`);
                }

                // 2. Process actual IntaSend refund (this also updates escrow)
                const refundResponse = await fetch(`${supabaseUrl}/functions/v1/process-refund`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                        orderId: order.id,
                        reason: "Vendor did not respond within 48 hours",
                    }),
                });

                const refundResult = await refundResponse.json();

                if (!refundResponse.ok || !refundResult.success) {
                    console.warn(`Refund warning for order ${order.id}:`, refundResult.error || "Unknown refund error");
                    // Continue anyway - order is cancelled, manual intervention may be needed
                } else {
                    console.log(`IntaSend refund initiated for order ${order.id}`);
                }

                // 3. Notify customer about auto-cancellation and refund
                fetch(`${supabaseUrl}/functions/v1/notify-buyer-order-declined`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                        orderId: order.id,
                        isAutoDeclined: true,
                    }),
                }).catch(err => console.log(`Buyer notification failed for ${order.id}:`, err));

                // 4. Notify vendor about missed order and reputation impact
                try {
                    // Get vendor email
                    const { data: vendorAuth } = await supabase.auth.admin.getUserById(order.vendor_id);
                    const vendorEmail = vendorAuth?.user?.email;

                    // Get vendor profile for store name
                    const { data: vendorProfile } = await supabase
                        .from("profiles")
                        .select("store_name, full_name")
                        .eq("id", order.vendor_id)
                        .single();

                    const businessName = vendorProfile?.store_name || vendorProfile?.full_name || "Vendor";
                    const itemsList = order.order_items
                        ?.map((item: any) => `${item.quantity}x ${item.product_name}`)
                        .join(", ") || "Items";
                    const customerName = order.order_shipping_details?.recipient_name || "Customer";

                    if (vendorEmail) {
                        await sendEmail({
                            to: vendorEmail,
                            subject: `⚠️ Missed Order Alert - Order #${order.id.slice(0, 8)}`,
                            html: emailTemplates.vendorMissedOrder({
                                businessName,
                                orderId: order.id.slice(0, 8),
                                items: itemsList,
                                total: order.total_ksh,
                                customerName,
                            }),
                        });
                        console.log(`Vendor ${order.vendor_id} notified about missed order`);
                    }
                } catch (vendorNotifyError) {
                    console.warn(`Vendor notification failed for ${order.id}:`, vendorNotifyError);
                    // Non-blocking - continue with other orders
                }

                console.log(`Order ${order.id} auto-cancelled, IntaSend refund initiated, buyer and vendor notified`);

                results.cancelled++;
            } catch (error) {
                console.error(`Failed to process order ${order.id}:`, error);
                results.failed++;
                results.errors.push(`Order ${order.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        }

        console.log(`Auto-cancel complete: ${results.cancelled} cancelled, ${results.failed} failed`);

        return new Response(
            JSON.stringify({
                message: "Auto-cancel job completed",
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
