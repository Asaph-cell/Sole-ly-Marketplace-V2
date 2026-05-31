/**
 * Generate Package PIN (V2)
 *
 * Called when vendor marks an order as "Dispatched".
 * Generates a 3-digit Package PIN that the vendor writes on the physical package.
 * The buyer enters this PIN in-app to confirm receipt, which starts the 6-hour
 * auto-release countdown.
 *
 * For PICKUP orders: this function is NOT called. Only the 6-digit OTP matters.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Generate a cryptographically random 6-digit OTP (100000–999999) */
function generateDeliveryOTP(): string {
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

        // Authenticate caller
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing auth header");
        const token = authHeader.replace("Bearer ", "");
        const parts = token.split(".");
        if (parts.length !== 3) throw new Error("Invalid token format");
        const userId = JSON.parse(atob(parts[1])).sub;
        if (!userId) throw new Error("Invalid user token");

        const { orderId } = await req.json();
        if (!orderId) throw new Error("Missing orderId");

        // Fetch order & verify vendor ownership
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("id, vendor_id, status")
            .eq("id", orderId)
            .single();

        if (orderError || !order) throw new Error("Order not found");
        if (order.vendor_id !== userId) throw new Error("Unauthorized — not your order");

        // Allowed statuses when vendor marks as shipped/arrived
        const validStatuses = ["accepted", "shipped", "arrived", "dispatched"];
        if (!validStatuses.includes(order.status)) {
            throw new Error(`Cannot generate OTP for order in status: ${order.status}.`);
        }

        const otp = generateDeliveryOTP();
        const now = new Date().toISOString();

        // Update order: set the 6-digit delivery OTP
        const { error: updateError } = await supabase
            .from("orders")
            .update({
                delivery_otp: otp,
            })
            .eq("id", order.id);

        if (updateError) throw updateError;

        console.log(`Delivery OTP generated for order ${orderId}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Delivery code generated successfully.",
                orderId,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error generating package PIN:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

