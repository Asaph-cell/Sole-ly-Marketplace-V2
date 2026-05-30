/**
 * Notify Vendor of New Order
 * 
 * This Edge Function is triggered when a new order is created.
 * It sends email and in-app notifications to the vendor about the new order.
 * 
 * Features:
 * - Email notification with retry (up to 3 attempts with exponential backoff)
 * - Push notification
 * - In-app notification
 * - Logging of all notification attempts to notification_logs table
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderPayload {
    type: "INSERT";
    table: "orders";
    record: {
        id: string;
        vendor_id: string;
        customer_id: string;
        total_ksh: number;
        status: string;
        created_at: string;
    };
    schema: "public";
}

// Helper: Log notification attempt
async function logNotification(
    supabase: any,
    params: {
        userId: string;
        orderId: string;
        type: 'email' | 'push' | 'in_app';
        channel: string;
        status: 'pending' | 'sent' | 'failed' | 'retrying';
        recipient?: string;
        errorMessage?: string;
        retryCount?: number;
        metadata?: Record<string, any>;
    }
) {
    try {
        await supabase.from("notification_logs").insert({
            user_id: params.userId,
            order_id: params.orderId,
            type: params.type,
            channel: params.channel,
            status: params.status,
            recipient: params.recipient,
            error_message: params.errorMessage,
            retry_count: params.retryCount || 0,
            metadata: params.metadata || {},
        });
    } catch (error) {
        console.log("Could not log notification (table may not exist):", error);
    }
}

// Helper: Send email with retry
async function sendEmailWithRetry(
    emailParams: Parameters<typeof sendEmail>[0],
    maxRetries: number = 3
): Promise<{ success: boolean; retryCount: number; error?: string }> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const result = await sendEmail(emailParams);
            if (result.success) {
                return { success: true, retryCount: attempt };
            }
            lastError = result.error || "Unknown error";
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Unknown error";
        }

        // Exponential backoff: wait 1s, 2s, 4s
        if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Email attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return { success: false, retryCount: maxRetries - 1, error: lastError };
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Parse the webhook payload or direct call
        const body = await req.json();

        let orderId: string;
        let vendorId: string;
        let totalKsh: number;

        // Check if this is a webhook payload or direct call
        if (body.type === "INSERT" && body.table === "orders") {
            // Webhook payload
            const payload = body as OrderPayload;
            orderId = payload.record.id;
            vendorId = payload.record.vendor_id;
            totalKsh = payload.record.total_ksh;
        } else if (body.orderId) {
            // Direct call - fetch vendorId from order if not provided
            orderId = body.orderId;

            if (body.vendorId) {
                vendorId = body.vendorId;
            } else {
                // Fetch vendorId from the order record
                const { data: orderRecord, error: orderFetchError } = await supabase
                    .from("orders")
                    .select("vendor_id")
                    .eq("id", body.orderId)
                    .single();

                if (orderFetchError || !orderRecord) {
                    console.error("Failed to fetch order for vendorId:", orderFetchError);
                    return new Response(
                        JSON.stringify({ error: "Order not found" }),
                        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
                vendorId = orderRecord.vendor_id;
                console.log("Fetched vendorId from order:", vendorId);
            }

            totalKsh = body.totalKsh || 0;
        } else {
            return new Response(
                JSON.stringify({ error: "Invalid payload" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch vendor details from profiles table
        const { data: vendor, error: vendorError } = await supabase
            .from("profiles")
            .select("store_name, whatsapp_number, id")
            .eq("id", vendorId)
            .single();

        if (vendorError || !vendor) {
            console.error("Failed to fetch vendor:", vendorError);
            // Continue anyway - we can still notify via email
        }

        // Use store_name as business_name fallback
        const businessName = vendor?.store_name || "Vendor";

        // Get vendor email from auth.users
        const { data: vendorAuth } = await supabase.auth.admin.getUserById(vendorId);
        const vendorEmail = vendorAuth?.user?.email;

        // Fetch order details with items
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select(`
        id,
        total_ksh,
        subtotal_ksh,
        shipping_fee_ksh,
        created_at,
        order_items(product_name, quantity, unit_price_ksh),
        order_shipping_details(recipient_name, city, delivery_type, gps_latitude, gps_longitude)
      `)
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            console.error("Failed to fetch order:", orderError);
            return new Response(
                JSON.stringify({ error: "Order not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build notification message
        const itemsList = order.order_items
            ?.map((item: any) => `${item.quantity}x ${item.product_name}`)
            .join(", ") || "Items";

        const deliveryType = order.order_shipping_details?.delivery_type === "pickup"
            ? "Pickup"
            : order.order_shipping_details?.city || "Delivery";

        const customerName = order.order_shipping_details?.recipient_name || "Customer";

        // Track notification results
        let emailSent = false;
        let pushSent = false;
        let inAppSent = false;

        // 1. Send email notification with retry
        if (vendorEmail) {
            // Build Google Maps link if GPS coordinates exist
            const hasGPS = order.order_shipping_details?.gps_latitude && order.order_shipping_details?.gps_longitude;
            const googleMapsLink = hasGPS
                ? `https://www.google.com/maps/search/?api=1&query=${order.order_shipping_details.gps_latitude},${order.order_shipping_details.gps_longitude}`
                : null;

            const emailResult = await sendEmailWithRetry({
                to: vendorEmail,
                subject: `🛒 New Order #${orderId.slice(0, 8)} - Action Required`,
                html: emailTemplates.vendorNewOrder({
                    businessName: businessName,
                    orderId: orderId.slice(0, 8),
                    items: itemsList,
                    total: order.total_ksh,
                    deliveryLocation: deliveryType,
                    customerName: customerName,
                    dashboardUrl: "https://solelymarketplace.com/vendor/orders",
                    googleMapsLink: googleMapsLink,
                }),
            });

            emailSent = emailResult.success;

            // Log email attempt
            await logNotification(supabase, {
                userId: vendorId,
                orderId: orderId,
                type: 'email',
                channel: 'vendor_new_order',
                status: emailResult.success ? 'sent' : 'failed',
                recipient: vendorEmail.substring(0, 3) + "***", // Privacy: truncate email
                errorMessage: emailResult.error,
                retryCount: emailResult.retryCount,
                metadata: { businessName, itemsCount: order.order_items?.length || 0 },
            });

            console.log(`Email ${emailResult.success ? 'sent' : 'failed'} after ${emailResult.retryCount + 1} attempt(s)`);
        } else {
            console.log("No vendor email found, skipping email notification");
            await logNotification(supabase, {
                userId: vendorId,
                orderId: orderId,
                type: 'email',
                channel: 'vendor_new_order',
                status: 'failed',
                errorMessage: 'No vendor email found',
            });
        }

        // 2. Store in-app notification
        try {
            await supabase.from("notifications").insert({
                user_id: vendorId,
                type: "new_order",
                title: "New Order Received",
                message: `New order #${orderId.slice(0, 8)}: ${itemsList} - KES ${order.total_ksh.toLocaleString()}. Reply within 48hrs.`,
                data: { orderId, totalKsh: order.total_ksh },
                read: false,
            });
            inAppSent = true;

            await logNotification(supabase, {
                userId: vendorId,
                orderId: orderId,
                type: 'in_app',
                channel: 'vendor_new_order',
                status: 'sent',
            });
        } catch (notifError) {
            console.log("Could not store in-app notification:", notifError);
            await logNotification(supabase, {
                userId: vendorId,
                orderId: orderId,
                type: 'in_app',
                channel: 'vendor_new_order',
                status: 'failed',
                errorMessage: notifError instanceof Error ? notifError.message : 'Unknown error',
            });
        }

        // 3. Send push notification
        try {
            const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                    userId: vendorId,
                    title: `🛒 New Order #${orderId.slice(0, 8)}`,
                    body: `${itemsList} - KES ${order.total_ksh.toLocaleString()}. Respond within 48hrs!`,
                    url: "/vendor/orders",
                    orderId: orderId,
                }),
            });

            if (pushResponse.ok) {
                const pushResult = await pushResponse.json();
                pushSent = pushResult.sent > 0;
                console.log("Push notification result:", pushResult);

                await logNotification(supabase, {
                    userId: vendorId,
                    orderId: orderId,
                    type: 'push',
                    channel: 'vendor_new_order',
                    status: pushSent ? 'sent' : 'failed',
                    metadata: { devicesSent: pushResult.sent, devicesTotal: pushResult.total },
                });
            } else {
                const errorText = await pushResponse.text();
                console.log("Push notification failed:", errorText);
                await logNotification(supabase, {
                    userId: vendorId,
                    orderId: orderId,
                    type: 'push',
                    channel: 'vendor_new_order',
                    status: 'failed',
                    errorMessage: errorText,
                });
            }
        } catch (pushError) {
            console.log("Could not send push notification:", pushError);
            await logNotification(supabase, {
                userId: vendorId,
                orderId: orderId,
                type: 'push',
                channel: 'vendor_new_order',
                status: 'failed',
                errorMessage: pushError instanceof Error ? pushError.message : 'Unknown error',
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Vendor notification sent",
                vendorId,
                orderId,
                emailSent,
                pushSent,
                inAppSent,
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
