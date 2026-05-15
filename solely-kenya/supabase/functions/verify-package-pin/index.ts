/**
 * Verify Package PIN (V2)
 *
 * Called by the BUYER after receiving their package.
 * The buyer enters the 3-digit PIN written on the package.
 *
 * On success:
 * 1. Order status → 'delivered'
 * 2. Generates 6-digit OTP (stored on order — buyer shows this to vendor)
 * 3. Sets auto_release_at = now + 6 hours (DELIVERY only; pickup skips this)
 *
 * The buyer then shows the 6-digit OTP to the vendor.
 * Vendor enters OTP via verify-delivery-otp → funds released immediately.
 * If vendor never enters OTP, auto-release fires after 6 hours.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Generate a cryptographically random 6-digit OTP */
function generateOTP(): string {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return (100000 + (arr[0] % 900000)).toString();
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Authenticate caller (must be the buyer)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing auth header");
        const token = authHeader.replace("Bearer ", "");
        const parts = token.split(".");
        if (parts.length !== 3) throw new Error("Invalid token format");
        const userId = JSON.parse(atob(parts[1])).sub;
        if (!userId) throw new Error("Invalid user token");

        const { orderId, pin } = await req.json();
        if (!orderId) throw new Error("Missing orderId");
        if (!pin) throw new Error("Missing pin");

        // Validate PIN format (3 digits)
        if (!/^\d{3}$/.test(pin)) {
            return new Response(
                JSON.stringify({ success: false, error: "Invalid PIN format — must be 3 digits" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch order
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select(`
                id,
                customer_id,
                vendor_id,
                status,
                package_pin,
                package_pin_entered_at,
                order_shipping_details(delivery_type)
            `)
            .eq("id", orderId)
            .single();

        if (orderError || !order) throw new Error("Order not found");

        // Only the buyer can enter the PIN
        if (order.customer_id !== userId) {
            return new Response(
                JSON.stringify({ success: false, error: "Unauthorized — you are not the buyer for this order" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Order must be in 'dispatched' state
        if (order.status !== "dispatched") {
            throw new Error(`Cannot verify PIN for order in status: ${order.status}. Expected: dispatched.`);
        }

        // Prevent double-entry
        if (order.package_pin_entered_at) {
            throw new Error("PIN already entered for this order.");
        }

        // Verify PIN matches
        if (order.package_pin !== pin) {
            console.log(`PIN mismatch for order ${orderId}: expected ${order.package_pin}, got ${pin}`);
            return new Response(
                JSON.stringify({ success: false, error: "Incorrect PIN. Please check the number on the package." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const now = new Date();
        const nowIso = now.toISOString();

        // Generate 6-digit OTP for fund release
        const otp = generateOTP();

        // Auto-release fires 6 hours after buyer enters PIN (delivery orders only)
        const deliveryType = order.order_shipping_details?.[0]?.delivery_type ?? "delivery";
        const autoReleaseAt = deliveryType === "delivery"
            ? new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
            : null; // No auto-release for pickup

        // Update order
        const { error: updateError } = await supabase
            .from("orders")
            .update({
                status: "delivered",
                package_pin_entered_at: nowIso,
                delivery_otp: otp,
                otp_generated_at: nowIso,
                otp_verified_at: null,       // Reset — vendor hasn't entered OTP yet
                auto_release_at: autoReleaseAt,
            })
            .eq("id", order.id);

        if (updateError) throw updateError;

        console.log(`PIN verified for order ${orderId}. OTP: ${otp}. Auto-release: ${autoReleaseAt ?? "N/A (pickup)"}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Package received! Show the code below to the vendor to release payment.",
                otp,              // 6-digit OTP shown to buyer — they show it to vendor
                autoReleaseAt,    // Null for pickup orders
                deliveryType,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error verifying package PIN:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
