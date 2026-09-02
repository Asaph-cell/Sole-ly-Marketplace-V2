/**
 * Resolve Dispute
 *
 * Single entry point for every admin dispute resolution action. Runs under
 * the service-role key so it's exempt from the orders_update_guardrails
 * trigger's customer/vendor-only actor check (that trigger only recognizes
 * an order's own customer/vendor or service_role - never admin - which is
 * why the old client-side "release funds" path in AdminDisputes.tsx always
 * failed after that trigger shipped). This also fixes a second, independent
 * bug: that old path never created a payout record, so a "release" never
 * actually credited the vendor even when it appeared to succeed.
 *
 * Actions:
 *   - release:        pay the vendor the full held amount
 *   - refund:         refund the buyer in full (via process-refund), no vendor payout
 *   - partial_refund: refund the buyer a specified amount AND auto-release
 *                      the vendor's remaining share in the same action
 *   - close:           dismiss with no financial action; restores the order
 *                      to its pre-dispute status
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ResolveAction = "release" | "refund" | "partial_refund" | "close";

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
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        const { data: adminRole } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .single();
        if (!adminRole) {
            return new Response(JSON.stringify({ error: "Admin access required" }), {
                status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
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

        if (!disputeId || !action) {
            return new Response(JSON.stringify({ error: "disputeId and action are required" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: dispute, error: disputeError } = await supabase
            .from("disputes")
            .select("*")
            .eq("id", disputeId)
            .single();
        if (disputeError || !dispute) {
            return new Response(JSON.stringify({ error: "Dispute not found" }), {
                status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (dispute.status.startsWith("resolved") || dispute.status === "closed") {
            return new Response(JSON.stringify({ error: "Dispute already resolved" }), {
                status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("id, vendor_id, total_ksh, commission_rate, pre_dispute_status")
            .eq("id", dispute.order_id)
            .single();
        if (orderError || !order) {
            return new Response(JSON.stringify({ error: "Order not found" }), {
                status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const now = new Date().toISOString();

        // Releases funds to the vendor from the held escrow amount (or a computed
        // remainder for a partial refund) - shared by "release" and "partial_refund".
        const releaseToVendor = async (amountKsh: number, commissionAmount: number) => {
            const { error: payoutError } = await supabase.from("payouts").insert({
                order_id: order.id,
                vendor_id: order.vendor_id,
                status: "pending",
                method: "mpesa",
                amount_ksh: amountKsh,
                commission_amount: commissionAmount,
            });
            if (payoutError) throw new Error(`Failed to create payout: ${payoutError.message}`);

            const { error: ledgerError } = await supabase.from("commission_ledger").insert({
                order_id: order.id,
                vendor_id: order.vendor_id,
                commission_rate: order.commission_rate,
                commission_amount: commissionAmount,
                notes: `Admin-resolved dispute (${disputeId})`,
            });
            if (ledgerError) console.error("[Resolve Dispute] Failed to record commission:", ledgerError);

            const transferResponse = await fetch(`${supabaseUrl}/functions/v1/transfer-to-vendor-wallet`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({ order_id: order.id }),
            });
            const transferResult = await transferResponse.json().catch(() => null);
            if (!transferResponse.ok || transferResult?.error) {
                // Don't fail the whole resolution over this - the payout row stays
                // 'pending' and can be retried, same fallback behavior as
                // auto-release-escrow/verify-delivery-otp use elsewhere.
                console.error("[Resolve Dispute] transfer-to-vendor-wallet failed:", transferResult);
            }

            fetch(`${supabaseUrl}/functions/v1/notify-order-completed`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
                body: JSON.stringify({ orderId: order.id }),
            }).catch((err) => console.error("[Resolve Dispute] Failed to trigger notify-order-completed:", err));
        };

        let newDisputeStatus: string;

        if (action === "release") {
            const { data: escrow } = await supabase
                .from("escrow_transactions")
                .select("*")
                .eq("order_id", order.id)
                .single();
            if (!escrow || escrow.status !== "held") {
                return new Response(JSON.stringify({ error: "Escrow not in a releasable state" }), {
                    status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const { data: claimed } = await supabase
                .from("escrow_transactions")
                .update({ status: "released", released_at: now })
                .eq("id", escrow.id)
                .eq("status", "held")
                .select("id")
                .maybeSingle();
            if (!claimed) {
                return new Response(JSON.stringify({ error: "Escrow was already released by another request" }), {
                    status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const { error: orderUpdateError } = await supabase
                .from("orders")
                .update({ status: "completed" })
                .eq("id", order.id);
            if (orderUpdateError) throw new Error(`Failed to complete order: ${orderUpdateError.message}`);

            await releaseToVendor(escrow.release_amount, escrow.commission_amount);
            newDisputeStatus = "resolved_release";

        } else if (action === "refund" || action === "partial_refund") {
            if (action === "partial_refund") {
                if (!partialRefundAmount || partialRefundAmount <= 0 || partialRefundAmount >= Number(order.total_ksh)) {
                    return new Response(JSON.stringify({ error: "Invalid partial refund amount" }), {
                        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
            }

            // Reuse process-refund rather than duplicating IntaSend chargeback logic.
            // Forward the ADMIN's own auth header - process-refund needs a resolvable
            // user (it does its own admin-role check), not the service-role key.
            const refundResponse = await fetch(`${supabaseUrl}/functions/v1/process-refund`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": authHeader },
                body: JSON.stringify({
                    orderId: order.id,
                    disputeId,
                    reason: dispute.reason,
                    refundAmount: action === "partial_refund" ? partialRefundAmount : undefined,
                }),
            });
            const refundResult = await refundResponse.json().catch(() => null);
            if (!refundResponse.ok || !refundResult?.success) {
                return new Response(
                    JSON.stringify({ error: refundResult?.error || "Failed to process refund" }),
                    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            if (action === "refund" && (applyVendorPenalty ?? true)) {
                const { error: penaltyError } = await supabase.from("vendor_ratings").insert({
                    vendor_id: dispute.vendor_id,
                    order_id: order.id,
                    buyer_id: dispute.customer_id,
                    rating: 1,
                    review: "System generated penalty: Dispute resolved in favor of buyer due to defective/fake item or non-delivery.",
                });
                if (penaltyError) console.error("[Resolve Dispute] Failed to apply vendor penalty:", penaltyError);
            }

            if (action === "partial_refund") {
                // process-refund already set orders.status='refunded' and
                // escrow_transactions.status='refunded' - now settle the vendor's
                // share of what's left and mark the order fully wound down.
                const remainder = Number(order.total_ksh) - partialRefundAmount!;
                const commissionOnRemainder = Number((remainder * (Number(order.commission_rate) / 100)).toFixed(2));
                const vendorShare = Number((remainder - commissionOnRemainder).toFixed(2));

                await releaseToVendor(vendorShare, commissionOnRemainder);

                const { error: completeError } = await supabase
                    .from("orders")
                    .update({ status: "completed" })
                    .eq("id", order.id);
                if (completeError) console.error("[Resolve Dispute] Failed to mark order completed after partial refund:", completeError);
            }

            newDisputeStatus = "resolved_refund";

        } else if (action === "close") {
            const { error: restoreError } = await supabase
                .from("orders")
                .update({ status: order.pre_dispute_status || "accepted" })
                .eq("id", order.id);
            if (restoreError) throw new Error(`Failed to restore order status: ${restoreError.message}`);

            newDisputeStatus = "closed";

        } else {
            return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { error: disputeUpdateError } = await supabase
            .from("disputes")
            .update({
                status: newDisputeStatus,
                resolved_at: now,
                resolved_by: user.id,
                resolution_notes: resolutionNotes || null,
            })
            .eq("id", disputeId);
        if (disputeUpdateError) throw new Error(`Failed to update dispute: ${disputeUpdateError.message}`);

        fetch(`${supabaseUrl}/functions/v1/notify-dispute-update`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ disputeId }),
        }).catch((err) => console.error("[Resolve Dispute] Failed to trigger notify-dispute-update:", err));

        return new Response(
            JSON.stringify({ success: true, disputeStatus: newDisputeStatus, message: "Dispute resolved" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[Resolve Dispute] Error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Failed to resolve dispute" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
