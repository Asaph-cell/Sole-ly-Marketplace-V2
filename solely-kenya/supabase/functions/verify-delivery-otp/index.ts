/**
 * Verify 6-Digit OTP & Release Funds
 *
 * Called when the VENDOR enters the 6-digit code the buyer gives them at
 * handover. The buyer sees the code on their order once it's marked
 * arrived (or ready for pickup). A matching code completes the order and
 * pays the vendor immediately, through the same releaseOrder path as the
 * buyer's "Yes, I got it" tap and the 6h auto-release.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit } from "../_shared/rate-limit.ts";
import { requireUserId, authErrorResponse } from "../_shared/auth.ts";
import { releaseOrder } from "../_shared/order-money.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

        // Verified by Supabase Auth, not just decoded: a forged token is rejected here.
        const userId = await requireUserId(req, supabase);

        const { orderId, otp } = await req.json();
        const limited = await rateLimit(req, corsHeaders, { name: "otp", max: 5, windowSeconds: 900, identity: `${userId}:${orderId}`, failClosed: true })
            ?? await rateLimit(req, corsHeaders, { name: "otp-user", max: 20, windowSeconds: 3600, identity: userId, failClosed: true });
        if (limited) return limited;

        if (!orderId) return json({ success: false, error: "Missing order" }, 400);
        if (!otp || !/^\d{6}$/.test(otp)) return json({ success: false, error: "Enter the buyer's 6-digit code." }, 400);

        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("id, vendor_id, status, delivery_otp")
            .eq("id", orderId)
            .single();

        if (orderError || !order) return json({ success: false, error: "Order not found" }, 404);
        if (order.vendor_id !== userId) return json({ success: false, error: "This isn't your order." }, 403);
        if (order.status === "completed") return json({ success: false, error: "This order is already complete." }, 409);
        if (order.status === "disputed") {
            return json({ success: false, error: "The buyer reported a problem with this order, so payment is on hold until it's sorted." }, 409);
        }
        if (!["arrived", "shipped"].includes(order.status)) {
            return json({ success: false, error: "Mark the order as arrived first." }, 409);
        }
        if (!order.delivery_otp) {
            return json({ success: false, error: "Mark the order as arrived so the buyer gets their code." }, 409);
        }
        if (order.delivery_otp !== otp) {
            return json({ success: false, error: "That code doesn't match. Check it with the buyer and try again." }, 400);
        }

        const result = await releaseOrder(supabase, orderId, { note: "Funds released via vendor OTP entry", otpVerified: true });

        return json({
            success: true,
            message: "Delivery confirmed! Funds have been released to your account.",
            payoutAmount: result.payout,
        });
    } catch (error) {
        const unauthorized = authErrorResponse(error, corsHeaders);
        if (unauthorized) return unauthorized;
        console.error("Error verifying delivery OTP:", error);
        return json({ success: false, error: "Something went wrong on our side. Please try again." }, 500);
    }
});
