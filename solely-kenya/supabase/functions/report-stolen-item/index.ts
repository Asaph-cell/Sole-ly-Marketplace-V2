/**
 * Report Stolen Item (V2)
 *
 * Called by a VENDOR after the 6-hour auto-release fires and funds are paid out,
 * but they believe the buyer stole the item (i.e., buyer entered the PIN to
 * start the countdown but then disappeared without showing the OTP).
 *
 * Creates a record in stolen_item_reports for admin review.
 * Admin can then ban the buyer from the platform.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Authenticate caller (must be the vendor)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing auth header");
        const token = authHeader.replace("Bearer ", "");
        const parts = token.split(".");
        if (parts.length !== 3) throw new Error("Invalid token format");
        const userId = JSON.parse(atob(parts[1])).sub;
        if (!userId) throw new Error("Invalid user token");

        const { orderId, description } = await req.json();
        if (!orderId) throw new Error("Missing orderId");

        // Fetch order
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("id, vendor_id, customer_id, status, stolen_item_reported, completed_at")
            .eq("id", orderId)
            .single();

        if (orderError || !order) throw new Error("Order not found");
        if (order.vendor_id !== userId) throw new Error("Unauthorized — not your order");

        // Can only report on completed orders (auto-release fired)
        if (order.status !== "completed") {
            throw new Error(`Order must be completed before filing a stolen item report. Current status: ${order.status}`);
        }

        // Prevent duplicate reports
        if (order.stolen_item_reported) {
            throw new Error("A stolen item report has already been filed for this order.");
        }

        const now = new Date().toISOString();

        // Check for existing report
        const { data: existing } = await supabase
            .from("stolen_item_reports")
            .select("id")
            .eq("order_id", orderId)
            .single();

        if (existing) {
            throw new Error("A stolen item report already exists for this order.");
        }

        // Create report
        const { error: reportError } = await supabase
            .from("stolen_item_reports")
            .insert({
                order_id: orderId,
                vendor_id: userId,
                buyer_id: order.customer_id,
                description: description ?? "No description provided.",
                reported_at: now,
            });

        if (reportError) throw reportError;

        // Flag the order
        const { error: flagError } = await supabase
            .from("orders")
            .update({
                stolen_item_reported: true,
                stolen_item_reported_at: now,
            })
            .eq("id", orderId);

        if (flagError) {
            console.error("Failed to flag order with stolen_item_reported:", flagError);
        }

        console.log(`Stolen item report filed: order=${orderId}, vendor=${userId}, buyer=${order.customer_id}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Report submitted. Our team will review this within 24 hours. If confirmed, the buyer will be banned.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error filing stolen item report:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
