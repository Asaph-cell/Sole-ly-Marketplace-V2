/**
 * Notify Buyer Pickup Ready
 * 
 * Sends email to buyer when vendor marks order as ready for pickup.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit } from "../_shared/rate-limit.ts";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // Open endpoint (called server-to-server too), so cap per IP to stop email/push spam.
    const limited = await rateLimit(req, corsHeaders, { name: "notify-buyer-pickup-ready", max: 120, windowSeconds: 60 });
    if (limited) return limited;

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
                delivery_otp,
                order_items(product_name, quantity),
                order_shipping_details(recipient_name, email)
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

        // Get vendor profile with location
        const { data: vendor } = await supabase
            .from("profiles")
            .select("store_name, vendor_address_line1, vendor_address_line2, vendor_city, vendor_county, whatsapp_number")
            .eq("id", order.vendor_id)
            .single();

        const vendorName = vendor?.store_name || "The vendor";
        const vendorAddress = [
            vendor?.vendor_address_line1,
            vendor?.vendor_address_line2,
            vendor?.vendor_city && vendor?.vendor_county ? `${vendor.vendor_city}, ${vendor.vendor_county}` : vendor?.vendor_city || vendor?.vendor_county
        ].filter(Boolean).join(", ") || "Location details will be shared by the vendor";

        const customerName = order.order_shipping_details?.recipient_name || "Customer";
        const itemsList = order.order_items
            ?.map((item: any) => `${item.quantity}x ${item.product_name}`)
            .join(", ") || "Items";

        // Send email with OTP
        const emailResult = await sendEmail({
            to: customerEmail,
            subject: `📦 Order Ready for Pickup - #${orderId.slice(0, 8)} ${order.delivery_otp ? '(Pickup Code Inside)' : ''}`,
            html: emailTemplates.buyerPickupReady({
                customerName,
                orderId: orderId.slice(0, 8),
                items: itemsList,
                vendorName,
                vendorAddress,
                vendorPhone: vendor?.whatsapp_number || "",
                vendorWhatsApp: vendor?.whatsapp_number || "",
                deliveryOtp: order.delivery_otp || undefined,
            }),
        });

        console.log("Buyer pickup ready notification sent:", emailResult);

        // Store notification
        try {
            await supabase.from("notifications").insert({
                user_id: order.customer_id,
                type: "pickup_ready",
                title: "Order Ready for Pickup",
                message: `Your order #${orderId.slice(0, 8)} from ${vendorName} is ready for collection!`,
                related_id: orderId,
            });
        } catch (notifError) {
            console.log("Could not store notification");
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Pickup ready notification sent",
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
