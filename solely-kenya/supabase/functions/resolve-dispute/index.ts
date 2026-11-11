/**
 * Resolve Dispute
 *
 * Single entry point for every admin dispute decision. Money moves only
 * through _shared/order-money.ts, so admin decisions follow the same rules
 * as automatic ones (commission on products only, refunds out of products
 * first, never more than the buyer paid).
 *
 * Actions:
 *   - release:        pay the vendor everything that's held
 *   - refund:         refund the buyer in full, no vendor payout
 *   - partial_refund: refund the buyer a set amount and release the rest
 *                     to the vendor. (Previously the vendor was also paid
 *                     their full original share - the transfer used the
 *                     order's unchanged payout_amount.)
 *   - close:          dismiss with no money moved; the order goes back to
 *                     where it was and its clock restarts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refundOrder, releaseOrder } from "../_shared/order-money.ts";
import { closeDispute } from "../_shared/disputes.ts";
import { deliverClock, releaseClock, startTimer } from "../_shared/timers.ts";
import { UserError } from "../_shared/errors.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ResolveAction = "release" | "refund" | "partial_refund" | "close";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ── Verify caller is an admin ──────────────────────────────────────
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return json({ error: "Unauthorized" }, 401);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return json({ error: "Unauthorized" }, 401);
        const { data: adminRole } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();
        if (!adminRole) return json({ error: "Admin access required" }, 403);
        // ── End auth ────────────────────────────────────────────────────────

        const {
            disputeId,
            action,
            partialRefundAmount,
            applyVendorPenalty,
            resolutionNotes,
        }: {
            disputeId: string;
            action: ResolveAction;
            partialRefundAmount?: number;
            applyVendorPenalty?: boolean;
            resolutionNotes?: string;
        } = await req.json();

        if (!disputeId || !action) return json({ error: "disputeId and action are required" }, 400);

        const { data: dispute, error: disputeError } = await supabase
            .from("disputes")
            .select("*")
            .eq("id", disputeId)
            .single();
        if (disputeError || !dispute) return json({ error: "Dispute not found" }, 404);

        // An appeal reopens an automatically-resolved dispute for an admin
        // decision; anything else that's resolved stays resolved.
        const resolved = dispute.status.startsWith("resolved") || dispute.status === "closed";
        if (resolved && !dispute.appeal_requested_at) return json({ error: "Dispute already resolved" }, 409);

        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("id, vendor_id, total_ksh, refunded_ksh, status, pre_dispute_status")
            .eq("id", dispute.order_id)
            .single();
        if (orderError || !order) return json({ error: "Order not found" }, 404);

        const notes = resolutionNotes || null;
        const activityDetails: Record<string, unknown> = { order_id: order.id, resolution_notes: notes };

        if (action === "release") {
            const result = await releaseOrder(supabase, order.id, { note: `Admin-resolved dispute (${disputeId})` });
            if (!result.released) return json({ error: "This order can't be paid out from its current state." }, 409);
            await closeDispute(supabase, disputeId, "vendor", notes ?? "Solely decided in the vendor's favour", user.id);
            activityDetails.amount_released = result.payout;

        } else if (action === "refund") {
            const result = await refundOrder(supabase, order.id, { reason: dispute.dispute_type ?? dispute.reason ?? "other" });
            if (applyVendorPenalty ?? true) {
                const { error: penaltyError } = await supabase.from("vendor_ratings").insert({
                    vendor_id: dispute.vendor_id,
                    order_id: order.id,
                    buyer_id: dispute.customer_id,
                    rating: 1,
                    review: "System generated penalty: Dispute resolved in favor of buyer due to defective/fake item or non-delivery.",
                });
                if (penaltyError) console.error("[Resolve Dispute] Failed to apply vendor penalty:", penaltyError);
            }
            await closeDispute(supabase, disputeId, "buyer", notes ?? "Solely refunded the buyer in full", user.id);
            activityDetails.refund_amount = result.refunded;
            activityDetails.vendor_penalized = applyVendorPenalty ?? true;

        } else if (action === "partial_refund") {
            const remaining = Number(order.total_ksh) - Number(order.refunded_ksh ?? 0);
            if (!partialRefundAmount || partialRefundAmount <= 0 || partialRefundAmount >= remaining) {
                return json({ error: `Enter a partial refund between 1 and ${Math.floor(remaining - 1)}.` }, 400);
            }
            await refundOrder(supabase, order.id, { amount: partialRefundAmount, reason: dispute.dispute_type ?? "other" });
            const result = await releaseOrder(supabase, order.id, { note: `Admin partial refund of ${partialRefundAmount} (${disputeId})` });
            await closeDispute(supabase, disputeId, "split", notes ?? `Solely refunded ${partialRefundAmount} and released the rest`, user.id);
            activityDetails.refund_amount = partialRefundAmount;
            activityDetails.amount_released = result.payout;

        } else if (action === "close") {
            if (order.status !== "disputed") return json({ error: "This order isn't on hold, so there's nothing to restore." }, 409);
            const restored = order.pre_dispute_status || "arrived";
            const { error: restoreError } = await supabase
                .from("orders")
                .update({ status: restored })
                .eq("id", order.id);
            if (restoreError) throw new Error(`Failed to restore order status: ${restoreError.message}`);
            await supabase.from("escrow_transactions").update({ status: "held" }).eq("order_id", order.id).eq("status", "withheld");

            // Restart the clock the order would have been on.
            const now = new Date();
            if (restored === "shipped") {
                const clock = await deliverClock(supabase, order.id, now, 24);
                await startTimer(supabase, order.id, "deliver", clock.due, { schedule: clock.schedule });
            } else if (["arrived", "delivered"].includes(restored)) {
                const clock = await releaseClock(supabase, now);
                await startTimer(supabase, order.id, "release", clock.due, { schedule: clock.schedule });
            }
            await closeDispute(supabase, disputeId, "vendor", notes ?? "Dismissed by Solely", user.id, "closed");
            activityDetails.restored_status = restored;

        } else {
            return json({ error: `Unknown action: ${action}` }, 400);
        }

        const { error: activityError } = await supabase.from("admin_activity_log").insert({
            admin_id: user.id,
            action_type: `resolve_dispute_${action}`,
            target_type: "dispute",
            target_id: disputeId,
            vendor_id: order.vendor_id,
            details: activityDetails,
        });
        if (activityError) console.error("[Resolve Dispute] Failed to record admin activity:", activityError);

        fetch(`${supabaseUrl}/functions/v1/notify-dispute-update`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ disputeId }),
        }).catch((err) => console.error("[Resolve Dispute] Failed to trigger notify-dispute-update:", err));

        const disputeStatus = action === "release" ? "resolved_release" : action === "close" ? "closed" : "resolved_refund";
        return json({ success: true, disputeStatus, message: "Dispute resolved" });

    } catch (error) {
        console.error("[Resolve Dispute] Error:", error);
        return json(
            { error: error instanceof Error ? error.message : "Failed to resolve dispute" },
            error instanceof UserError ? 409 : 500,
        );
    }
});
