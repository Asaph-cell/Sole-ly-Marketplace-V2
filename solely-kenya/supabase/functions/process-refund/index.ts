/**
 * Process Refund via IntaSend
 * 
 * Called when admin resolves a dispute with refund action.
 * Uses IntaSend's Chargeback API to initiate refund.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map our dispute reasons to IntaSend's accepted reasons
const mapReasonToIntaSend = (reason: string): string => {
    const mapping: Record<string, string> = {
        "no_delivery": "Delayed delivery",
        "wrong_item": "Wrong service",
        "damaged": "Other",
        "other": "Other",
    };
    return mapping[reason] || "Other";
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const intaSendSecretKey = Deno.env.get("INTASEND_SECRET_KEY");

        if (!intaSendSecretKey) {
            throw new Error("INTASEND_SECRET_KEY not configured");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { orderId, disputeId, reason, refundAmount } = await req.json();

        if (!orderId) {
            throw new Error("orderId is required");
        }

        console.log(`[Refund] Processing refund for order: ${orderId}`);

        // 1. Fetch payment record to get transaction_id
        const { data: payment, error: paymentError } = await supabase
            .from("payments")
            .select("id, transaction_id, amount_ksh, status, gateway")
            .eq("order_id", orderId)
            .order("created_at", { ascending: true })
            .limit(1)
            .single();

        if (paymentError || !payment) {
            console.error("[Refund] Payment not found:", paymentError);
            throw new Error("Payment record not found for this order");
        }

        if (payment.status === "refunded") {
            console.log("[Refund] Payment already refunded");
            return new Response(
                JSON.stringify({ success: true, message: "Payment already refunded", alreadyRefunded: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!payment.transaction_id) {
            console.error("[Refund] No transaction_id found on payment");
            throw new Error("Cannot process refund: No transaction reference found. This order may have been placed before the webhook fix.");
        }

        // 2. Call IntaSend Chargeback API
        console.log(`[Refund] Calling IntaSend chargeback API for invoice: ${payment.transaction_id}`);

        const chargebackPayload = {
            invoice: payment.transaction_id,
            amount: refundAmount ? Number(refundAmount) : Number(payment.amount_ksh),
            reason: mapReasonToIntaSend(reason || "other"),
        };

        console.log("[Refund] Chargeback payload:", JSON.stringify(chargebackPayload));

        const response = await fetch("https://api.intasend.com/api/v1/chargebacks/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${intaSendSecretKey}`,
            },
            body: JSON.stringify(chargebackPayload),
        });

        const responseText = await response.text();
        console.log("[Refund] IntaSend response:", responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error("[Refund] Invalid JSON response from IntaSend");
            throw new Error("IntaSend returned invalid response");
        }

        if (!response.ok) {
            const errorMessage = data?.detail || data?.message || data?.error || "Refund request failed";
            console.error("[Refund] IntaSend error:", errorMessage);
            throw new Error(`IntaSend: ${errorMessage}`);
        }

        console.log("[Refund] IntaSend chargeback created successfully");

        // 3. Update payment status
        const { error: updateError } = await supabase
            .from("payments")
            .update({
                status: "refunded",
                refunded_at: new Date().toISOString(),
            })
            .eq("id", payment.id);

        if (updateError) {
            console.error("[Refund] Failed to update payment status:", updateError);
            // Don't throw - refund was initiated at IntaSend
        }

        // 4. Update order status if not already refunded
        await supabase
            .from("orders")
            .update({ status: "refunded" })
            .eq("id", orderId);

        // 5. Update escrow if exists
        await supabase
            .from("escrow_transactions")
            .update({
                status: "refunded",
                refunded_at: new Date().toISOString()
            })
            .eq("order_id", orderId);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Refund initiated successfully",
                chargebackId: data.id || null,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[Refund] Error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Refund processing failed"
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
