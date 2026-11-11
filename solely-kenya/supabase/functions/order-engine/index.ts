/**
 * Order Engine (scheduled, every 5 minutes)
 *
 * Runs every order clock in order_timers (docs/DISPUTE_SYSTEM_SPEC.md):
 * sends the reminders in each timer's schedule, then fires its outcome at
 * due_at. Replaces auto-release-escrow and auto-refund-unshipped.
 *
 * Each step claims its timer with a conditional UPDATE first, so two
 * overlapping runs can never send a reminder twice or refund twice.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceCall } from "../_shared/auth.ts";
import { alertAdmins } from "../_shared/admin-alerts.ts";
import { loadParties, notify, type OrderParties } from "../_shared/notify.ts";
import { refundOrder, releaseOrder } from "../_shared/order-money.ts";
import { addStrike } from "../_shared/strikes.ts";
import { closeDispute, escalateDispute } from "../_shared/disputes.ts";
import { formatKenyaTime } from "../_shared/business-hours.ts";
import type { TimerRow } from "../_shared/timers.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ksh = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;

interface Run {
    supabase: SupabaseClient;
    timer: TimerRow;
    p: OrderParties;
    due: Date;
}

// ── Reminders (stage < schedule.length) ────────────────────────────────────

async function remind(run: Run) {
    const { supabase, timer, p, due } = run;
    const last = timer.stage === (timer.meta.schedule?.length ?? 0) - 1;

    switch (timer.kind) {
        case "ship":
            return notify(supabase, p, "vendor", {
                subject: last ? `Ship order #${p.shortId} now` : `Time to ship order #${p.shortId}`,
                lines: [
                    last
                        ? `You accepted order #${p.shortId} (${p.items}) and the buyer has already paid. Shipping was expected by now.`
                        : `You accepted order #${p.shortId} (${p.items}). Please pack and ship it within the next couple of hours.`,
                    `Ship it, or send the buyer an update, by ${formatKenyaTime(due)}. Otherwise the buyer is refunded and your shop gets a strike.`,
                ],
                ctaLabel: "Ship the order",
                push: true,
                sms: last ? `Solely: ship order #${p.shortId} or send an update by ${formatKenyaTime(due)}, or the buyer is refunded and you get a strike.` : undefined,
            });

        case "deliver":
            return notify(supabase, p, "vendor", {
                subject: last ? `Last call: where is order #${p.shortId}?` : `Where is order #${p.shortId}?`,
                lines: [
                    `Order #${p.shortId} should reach the buyer by ${formatKenyaTime(due)}.`,
                    "Tap \"Send update\" on the order to tell the buyer where it is. That gives you more time.",
                    last ? "If we don't hear from you by then, the buyer is refunded in full and your shop gets a strike." : "",
                ].filter(Boolean),
                ctaLabel: "Send an update",
                push: true,
                sms: last ? `Solely: where is order #${p.shortId}? Send the buyer an update by ${formatKenyaTime(due)} or they're refunded.` : undefined,
            });

        case "release":
            return notify(supabase, p, "buyer", {
                subject: `Did you get order #${p.shortId}?`,
                lines: [
                    `${p.storeName} is paid ${formatKenyaTime(due)} unless you tell us something's wrong.`,
                    "Got it? Tap \"Yes, I got it\". Didn't arrive or something's wrong? Tap \"Something wrong?\" and we'll hold the payment.",
                ],
                ctaLabel: "Confirm my order",
                push: true,
                sms: `Solely: ${p.storeName} is paid ${formatKenyaTime(due)} for order #${p.shortId}. Problem? Report it now at solelymarketplace.com/orders`,
            });
    }
}

// ── Outcomes (at due_at) ───────────────────────────────────────────────────

async function fire(run: Run) {
    const { supabase, timer, p } = run;
    const orderId = timer.order_id;

    switch (timer.kind) {
        case "ship": {
            // A1: accepted, never shipped, never replied.
            const r = await refundOrder(supabase, orderId, { reason: "not_shipped" });
            await addStrike(supabase, p.vendorId, orderId, "not_shipped");
            await notify(supabase, p, "buyer", {
                subject: `Refunded: order #${p.shortId} wasn't shipped`,
                lines: [`${p.storeName} didn't ship your order in time, so we've refunded you ${ksh(r.refunded)} in full.`, "Sorry about that. The refund usually reaches M-Pesa within a few minutes."],
                sms: `Solely: ${p.storeName} didn't ship order #${p.shortId}. You've been refunded ${ksh(r.refunded)}.`,
            });
            await notify(supabase, p, "vendor", {
                subject: `Order #${p.shortId} cancelled and refunded`,
                lines: ["You didn't ship this order or send an update in time, so the buyer was refunded and your shop received a strike."],
            });
            return;
        }

        case "deliver": {
            // A4: shipped, never arrived, vendor went silent.
            const r = await refundOrder(supabase, orderId, { reason: "not_delivered" });
            await addStrike(supabase, p.vendorId, orderId, "not_delivered");
            await notify(supabase, p, "buyer", {
                subject: `Refunded: order #${p.shortId} didn't arrive`,
                lines: [`Your order didn't arrive in time and ${p.storeName} didn't tell us where it is, so we've refunded you ${ksh(r.refunded)} in full.`],
                sms: `Solely: order #${p.shortId} didn't arrive. You've been refunded ${ksh(r.refunded)}.`,
            });
            await notify(supabase, p, "vendor", {
                subject: `Order #${p.shortId} refunded: no delivery update`,
                lines: ["This order didn't arrive in time and you didn't send an update, so the buyer was refunded and your shop received a strike.", "If the goods are still on the way, collect them back."],
            });
            return;
        }

        case "release": {
            const result = await releaseOrder(supabase, orderId, {
                note: timer.meta.after_fix ? "Auto-released: buyer didn't respond after the fix" : "Auto-released: buyer didn't respond within the release window",
            });
            if (timer.meta.after_fix) {
                const { data: dispute } = await supabase.from("disputes").select("id").eq("order_id", orderId).maybeSingle();
                if (dispute) await closeDispute(supabase, dispute.id, "none", "Vendor sent the fix; buyer didn't respond");
            }
            if (result.released) {
                await notify(supabase, p, "vendor", {
                    subject: `Paid: order #${p.shortId}`,
                    lines: [`The buyer didn't report a problem, so ${ksh(result.payout)} has been released to your Solely balance.`],
                });
            }
            return;
        }

        case "checklist_hold": {
            await supabase.from("order_packing_checklists")
                .update({ buyer_status: "timed_out", updated_at: new Date().toISOString() })
                .eq("order_id", orderId).eq("buyer_status", "objected");
            await notify(supabase, p, "vendor", {
                subject: `You can ship order #${p.shortId}`,
                lines: ["The buyer didn't reply about the package list, so shipping is unlocked. If you changed anything, update the package list first."],
                push: true,
            });
            return;
        }

        case "vendor_response": {
            // Quality dispute and the vendor never answered: buyer refunded.
            const { data: dispute } = await supabase.from("disputes").select("id, dispute_type").eq("order_id", orderId).maybeSingle();
            const r = await refundOrder(supabase, orderId, { reason: dispute?.dispute_type ?? "other" });
            if (dispute) await closeDispute(supabase, dispute.id, "buyer", "Vendor didn't respond in time; buyer refunded in full");
            await notify(supabase, p, "buyer", {
                subject: `Refunded: order #${p.shortId}`,
                lines: [`${p.storeName} didn't respond to your report, so we've refunded you ${ksh(r.refunded)} in full.`],
            });
            await notify(supabase, p, "vendor", {
                subject: `Order #${p.shortId} refunded: no response`,
                lines: ["You didn't respond to the buyer's problem report in time, so they were refunded in full."],
            });
            return;
        }

        case "negotiation": {
            const { data: dispute } = await supabase.from("disputes").select("id").eq("order_id", orderId).maybeSingle();
            if (dispute) await escalateDispute(supabase, p, dispute.id, "Buyer and vendor didn't agree within the negotiation window.");
            return;
        }

        case "fix": {
            const { data: dispute } = await supabase.from("disputes").select("id, dispute_type").eq("order_id", orderId).maybeSingle();
            if (!dispute) return;
            const category = String(timer.meta.category ?? dispute.dispute_type);

            if (category === "missing_items") {
                // A7: buyer chooses between a refund for the missing items and
                // keeping the order as it is.
                await supabase.from("disputes").update({ stage: "buyer_choice" }).eq("id", dispute.id);
                await notify(supabase, p, "buyer", {
                    subject: `Missing items: what would you like? Order #${p.shortId}`,
                    lines: [`${p.storeName} didn't send the missing items in time.`, "Open your order and choose: a refund for the missing items, or keep the order as it is."],
                    ctaLabel: "Choose",
                    push: true,
                });
                return;
            }

            // A9 swap or an agreed replacement that never came: full refund.
            const r = await refundOrder(supabase, orderId, { reason: category });
            await closeDispute(supabase, dispute.id, "buyer", "Vendor didn't fix the order in time; buyer refunded in full");
            await notify(supabase, p, "buyer", {
                subject: `Refunded: order #${p.shortId}`,
                lines: [`${p.storeName} didn't fix your order in time, so we've refunded you ${ksh(r.refunded)} in full.`],
            });
            await notify(supabase, p, "vendor", {
                subject: `Order #${p.shortId} refunded`,
                lines: ["You didn't fix this order in time, so the buyer was refunded in full. Please collect the item from them."],
            });
            return;
        }

        case "return_confirm": {
            // Buyer handed the item back; vendor stayed silent.
            const { data: dispute } = await supabase.from("disputes").select("id, dispute_type").eq("order_id", orderId).maybeSingle();
            const r = await refundOrder(supabase, orderId, { reason: dispute?.dispute_type ?? "other" });
            if (dispute) await closeDispute(supabase, dispute.id, "buyer", "Vendor didn't confirm the return in time; buyer refunded");
            await notify(supabase, p, "buyer", {
                subject: `Refunded: order #${p.shortId}`,
                lines: [`You've been refunded ${ksh(r.refunded)} for the item you handed back.`],
            });
            await notify(supabase, p, "vendor", {
                subject: `Order #${p.shortId} refunded`,
                lines: ["You didn't confirm or dispute the returned item in time, so the buyer was refunded."],
            });
            return;
        }

        case "buyer_unavailable": {
            // B3: buyer never responded. They get the item price back; the
            // vendor keeps the delivery fee (it covered the trip both ways).
            const { data: order } = await supabase.from("orders").select("subtotal_ksh, refunded_ksh").eq("id", orderId).single();
            const productsLeft = Math.max(0, Number(order!.subtotal_ksh) - Number(order!.refunded_ksh ?? 0));
            if (productsLeft > 0) await refundOrder(supabase, orderId, { amount: productsLeft, reason: "buyer_unavailable" });
            const result = await releaseOrder(supabase, orderId, { note: "Buyer unavailable: vendor keeps the delivery fee" });
            await notify(supabase, p, "buyer", {
                subject: `Order #${p.shortId} cancelled`,
                lines: [`We couldn't reach you to deliver your order, so it's been cancelled. You've been refunded ${ksh(productsLeft)} for the items. The delivery fee went to the seller for the trip.`],
                sms: `Solely: order #${p.shortId} cancelled, buyer unreachable. Refunded ${ksh(productsLeft)}.`,
            });
            await notify(supabase, p, "vendor", {
                subject: `Order #${p.shortId} cancelled: buyer unavailable`,
                lines: [`The buyer didn't respond, so the order was cancelled. You keep the delivery fee (${ksh(result.payout)}).`],
            });
            return;
        }
    }
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function processTimer(supabase: SupabaseClient, timer: TimerRow): Promise<"reminded" | "fired" | "skipped"> {
    const schedule = timer.meta.schedule ?? [];
    const isReminder = timer.stage < schedule.length;

    // Claim the step: only the run that moves stage/status forward acts.
    const claim = isReminder
        ? {
            stage: timer.stage + 1,
            next_at: schedule[timer.stage + 1] ?? timer.due_at,
        }
        : { status: "fired", resolved_at: new Date().toISOString() };
    const { data: claimed } = await supabase
        .from("order_timers")
        .update(claim)
        .eq("id", timer.id)
        .eq("status", "active")
        .eq("stage", timer.stage)
        .select("id")
        .maybeSingle();
    if (!claimed) return "skipped";

    const p = await loadParties(supabase, timer.order_id);
    const run: Run = { supabase, timer, p, due: new Date(timer.due_at) };

    if (isReminder) {
        await remind(run);
        return "reminded";
    }
    await fire(run);
    return "fired";
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (!isServiceCall(req)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: timers, error } = await supabase
        .from("order_timers")
        .select("*")
        .eq("status", "active")
        .lte("next_at", new Date().toISOString())
        .order("next_at", { ascending: true })
        .limit(100);

    if (error) {
        console.error("[Order Engine] Couldn't load timers:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const counts = { reminded: 0, fired: 0, skipped: 0, failed: 0 };
    for (const timer of (timers ?? []) as TimerRow[]) {
        try {
            counts[await processTimer(supabase, timer)]++;
        } catch (err) {
            counts.failed++;
            console.error(`[Order Engine] ${timer.kind} timer ${timer.id} on order ${timer.order_id} failed:`, err);
            // The step was claimed but its action failed, so it won't be
            // retried on its own. Leave a trace and get a human.
            const message = err instanceof Error ? err.message : String(err);
            await supabase.from("order_timers")
                .update({ meta: { ...timer.meta, last_error: message } })
                .eq("id", timer.id);
            await alertAdmins(supabase, `Order clock failed: #${timer.order_id.slice(0, 8)}`,
                `The automatic "${timer.kind}" step for this order failed and needs handling by hand.`,
                { Order: timer.order_id, Timer: timer.kind, Error: message });
        }
    }

    console.log("[Order Engine] Done:", counts);
    return new Response(JSON.stringify({ success: true, ...counts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
