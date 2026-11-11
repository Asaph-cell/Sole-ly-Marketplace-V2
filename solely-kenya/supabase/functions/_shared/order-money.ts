/**
 * The only two ways money leaves a held order: back to the buyer
 * (refundOrder) or on to the vendor (releaseOrder).
 *
 * Everything that resolves an order - the buyer's "Yes, I got it", the
 * vendor's OTP, the 6h auto-release, a timer refund, an accepted offer, an
 * admin decision - goes through these, so the rules live in one place:
 *
 *   - Commission is charged on products only, never the delivery fee.
 *   - Refunds come out of the products first; the vendor keeps the
 *     delivery fee unless the buyer is owed the full amount.
 *   - refunded_ksh + the vendor's payout + commission never exceed what the
 *     buyer paid.
 *   - Each step claims the order with a conditional UPDATE, so two callers
 *     (a cron tick and a button tap) can never both pay out.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alertAdmins } from "./admin-alerts.ts";
import { UserError } from "./errors.ts";

const round2 = (n: number) => Math.round(n * 100) / 100;

const INTASEND_REASONS: Record<string, string> = {
    not_shipped: "Delayed delivery",
    not_delivered: "Delayed delivery",
    item_not_received: "Delayed delivery",
    wrong_item: "Wrong service",
    wrong_order: "Wrong service",
    missing_items: "Wrong service",
};

/** Statuses an order can be completed (paid out) from. */
const RELEASABLE = ["shipped", "arrived", "delivered", "disputed"];

export interface RefundOptions {
    /** KES to refund. Defaults to everything not yet refunded. */
    amount?: number;
    /** Machine reason, e.g. "not_shipped"; mapped to IntaSend's reason list. */
    reason: string;
    /**
     * Status to set when this refund leaves nothing for the vendor
     * (defaults to 'refunded'). Ignored for partial refunds.
     */
    finalStatus?: "refunded" | "cancelled_by_vendor";
}

export interface RefundResult {
    refunded: number;
    /** True once the buyer has their full payment back. */
    full: boolean;
}

/**
 * Refunds the buyer through IntaSend. Partial refunds leave the order's
 * status alone (it can still be released for the remainder later).
 */
export async function refundOrder(
    supabase: SupabaseClient,
    orderId: string,
    opts: RefundOptions,
): Promise<RefundResult> {
    const { data: order, error } = await supabase
        .from("orders")
        .select("id, vendor_id, total_ksh, refunded_ksh, status, payout_transferred_at")
        .eq("id", orderId)
        .single();
    if (error || !order) throw new Error(`Order not found: ${orderId}`);

    if (order.status === "completed" || order.payout_transferred_at) {
        throw new UserError("This order has already been paid out to the vendor, so it can't be refunded automatically.");
    }

    const total = Number(order.total_ksh);
    const already = Number(order.refunded_ksh ?? 0);
    const remaining = round2(total - already);
    const amount = round2(opts.amount ?? remaining);

    if (remaining <= 0) return { refunded: 0, full: true };
    if (!(amount > 0) || amount > remaining) {
        throw new Error(`Refund of ${amount} is outside 0..${remaining} for order ${orderId}`);
    }

    // Claim: bump refunded_ksh only if nobody else changed it meanwhile.
    const newTotal = round2(already + amount);
    const { data: claimed, error: claimError } = await supabase
        .from("orders")
        .update({ refunded_ksh: newTotal })
        .eq("id", orderId)
        .eq("refunded_ksh", already)
        .select("id")
        .maybeSingle();
    if (claimError) throw new Error(`Couldn't claim refund: ${claimError.message}`);
    if (!claimed) throw new UserError("Another refund for this order is already in progress.");

    const full = newTotal >= total;

    const { data: payment } = await supabase
        .from("payments")
        .select("id, transaction_id, status")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    // Nothing was ever captured (e.g. payment never completed): no money to
    // send back, just record the outcome.
    const needsGateway = payment && payment.status === "captured";

    if (needsGateway) {
        const secret = Deno.env.get("INTASEND_SECRET_KEY");
        let uncertain = false;
        try {
            if (!secret) throw new Error("INTASEND_SECRET_KEY is not configured");
            if (!payment.transaction_id) throw new Error("No IntaSend invoice reference on this payment");

            let res: Response;
            try {
                res = await fetch("https://api.intasend.com/api/v1/chargebacks/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
                    body: JSON.stringify({
                        invoice: payment.transaction_id,
                        amount,
                        reason: INTASEND_REASONS[opts.reason] ?? "Other",
                    }),
                });
            } catch (networkErr) {
                // We can't tell whether IntaSend got it - keep the claim so
                // the buyer can't be refunded twice, and get a human.
                uncertain = true;
                await alertAdmins(supabase, `Refund UNCERTAIN for order ${orderId.slice(0, 8)}`,
                    "The refund request to IntaSend failed mid-flight. Check IntaSend before retrying.",
                    { "Order ID": orderId, "Amount (KES)": amount, Reason: opts.reason, Error: String(networkErr) });
                throw networkErr;
            }

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`IntaSend refused the refund (${res.status}): ${text.slice(0, 300)}`);
            }
        } catch (err) {
            // Definite failure (or misconfiguration): undo the claim so it
            // can be retried, unless the uncertain path above already alerted.
            if (!uncertain) {
                await supabase.from("orders").update({ refunded_ksh: already }).eq("id", orderId).eq("refunded_ksh", newTotal);
                await alertAdmins(supabase, `Refund failed for order ${orderId.slice(0, 8)}`,
                    "A buyer refund did NOT go through. Fix the cause and retry from the admin dashboard.",
                    { "Order ID": orderId, "Amount (KES)": amount, Reason: opts.reason, Error: err instanceof Error ? err.message : String(err) });
            }
            throw err;
        }
    }

    const now = new Date().toISOString();
    if (full) {
        if (payment) {
            await supabase.from("payments").update({ status: "refunded", refunded_at: now }).eq("id", payment.id);
        }
        await supabase.from("orders").update({ status: opts.finalStatus ?? "refunded" }).eq("id", orderId);
        await supabase.from("escrow_transactions").update({ status: "refunded", refunded_at: now }).eq("order_id", orderId);
        await supabase.from("order_timers")
            .update({ status: "cancelled", resolved_at: now })
            .eq("order_id", orderId)
            .eq("status", "active");
    }

    console.log(`[Money] Refunded ${amount} on order ${orderId} (${full ? "full" : "partial"}, reason ${opts.reason})`);
    return { refunded: amount, full };
}

export interface ReleaseOptions {
    /** Shown in the commission ledger, e.g. "Buyer confirmed receipt". */
    note: string;
    /** Set when the release came from the vendor entering the OTP. */
    otpVerified?: boolean;
}

export interface ReleaseResult {
    released: boolean;
    payout: number;
}

/**
 * Completes the order and pays the vendor what's left after any partial
 * refunds. Safe to call twice: the second call finds the order already
 * completed and does nothing.
 */
export async function releaseOrder(
    supabase: SupabaseClient,
    orderId: string,
    opts: ReleaseOptions,
): Promise<ReleaseResult> {
    const { data: order, error } = await supabase
        .from("orders")
        .select("id, vendor_id, status, total_ksh, subtotal_ksh, refunded_ksh, commission_rate")
        .eq("id", orderId)
        .single();
    if (error || !order) throw new Error(`Order not found: ${orderId}`);
    if (order.status === "completed") return { released: false, payout: 0 };
    if (!RELEASABLE.includes(order.status)) {
        throw new Error(`Order ${orderId} can't be paid out from status ${order.status}`);
    }

    const total = Number(order.total_ksh);
    const refunded = Number(order.refunded_ksh ?? 0);
    const rate = Number(order.commission_rate ?? 6);
    // Refunds come out of the products first, so commission is only taken
    // on products the buyer actually kept.
    const productsKept = Math.max(0, Number(order.subtotal_ksh) - refunded);
    const commission = round2(productsKept * rate / 100);
    const payout = round2(total - refunded - commission);

    const now = new Date().toISOString();

    // Claim. payout_amount and status change in one UPDATE so the
    // order_completed_balance_trigger credits exactly this payout.
    const update: Record<string, unknown> = {
        status: "completed",
        completed_at: now,
        payout_amount: Math.max(0, payout),
        commission_amount: commission,
        buyer_confirmed: true,
        vendor_confirmed: true,
    };
    if (opts.otpVerified) update.otp_verified_at = now;

    const { data: claimed, error: claimError } = await supabase
        .from("orders")
        .update(update)
        .eq("id", orderId)
        .in("status", RELEASABLE)
        .select("id")
        .maybeSingle();
    if (claimError) throw new Error(`Couldn't complete order: ${claimError.message}`);
    if (!claimed) return { released: false, payout: 0 };

    await supabase.from("order_timers")
        .update({ status: "done", resolved_at: now })
        .eq("order_id", orderId)
        .eq("status", "active");
    await supabase.from("escrow_transactions").update({ status: "released", released_at: now }).eq("order_id", orderId);

    if (payout > 0) {
        const { error: payoutError } = await supabase.from("payouts").insert({
            order_id: orderId,
            vendor_id: order.vendor_id,
            status: "pending",
            method: "mpesa",
            amount_ksh: payout,
            commission_amount: commission,
        });
        if (payoutError) console.error(`[Money] Failed to create payout row for ${orderId}:`, payoutError);

        const { error: ledgerError } = await supabase.from("commission_ledger").insert({
            order_id: orderId,
            vendor_id: order.vendor_id,
            commission_rate: rate,
            commission_amount: commission,
            notes: opts.note,
        });
        if (ledgerError) console.error(`[Money] Failed to record commission for ${orderId}:`, ledgerError);

        await transferToVendorWallet(supabase, orderId, order.vendor_id, payout);
    }

    await decrementStock(supabase, orderId);

    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-order-completed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ orderId }),
    }).catch((err) => console.error("[Money] notify-order-completed failed:", err));

    console.log(`[Money] Released order ${orderId}: payout ${payout}, commission ${commission} (${opts.note})`);
    return { released: true, payout };
}

async function transferToVendorWallet(supabase: SupabaseClient, orderId: string, vendorId: string, payout: number) {
    try {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/transfer-to-vendor-wallet`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ order_id: orderId }),
        });
        const result = await res.json().catch(() => null);
        if (res.ok && !result?.error) return;

        // transfer-to-vendor-wallet has already alerted admins. Undo the
        // balance the completion trigger credited, since the money didn't move.
        console.error(`[Money] Wallet transfer failed for ${orderId}:`, result);
        const { data: bal } = await supabase
            .from("vendor_balances")
            .select("pending_balance, total_earned")
            .eq("vendor_id", vendorId)
            .maybeSingle();
        if (bal) {
            await supabase.from("vendor_balances").update({
                pending_balance: Math.max(0, Number(bal.pending_balance || 0) - payout),
                total_earned: Math.max(0, Number(bal.total_earned || 0) - payout),
                updated_at: new Date().toISOString(),
            }).eq("vendor_id", vendorId);
        }
    } catch (err) {
        console.error(`[Money] Couldn't reach transfer-to-vendor-wallet for ${orderId}:`, err);
    }
}

async function decrementStock(supabase: SupabaseClient, orderId: string) {
    const { data: items } = await supabase.from("order_items").select("product_id, quantity").eq("order_id", orderId);
    for (const item of items ?? []) {
        const { data: product } = await supabase.from("products").select("stock").eq("id", item.product_id).maybeSingle();
        if (product && typeof product.stock === "number") {
            await supabase.from("products").update({ stock: Math.max(0, product.stock - item.quantity) }).eq("id", item.product_id);
        }
    }
}
