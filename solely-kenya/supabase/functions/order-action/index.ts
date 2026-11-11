/**
 * Order Action
 *
 * The single entry point for every buyer and vendor button on an order
 * (docs/DISPUTE_SYSTEM_SPEC.md). Order status can no longer be changed
 * from the browser, so the timers, refunds and notifications that belong
 * to each step can't be skipped.
 *
 * Vendor: accept, decline, submit_checklist, ship, arrived, send_update,
 *         buyer_unavailable, make_offer, fix_sent, confirm_return, reject_return
 * Buyer:  confirm_received, report_problem, respond_checklist, respond_offer,
 *         make_offer, handed_back, fix_result, missing_choice, refund_now,
 *         unavailable_reply
 * Either: escalate, appeal
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit } from "../_shared/rate-limit.ts";
import { UserError } from "../_shared/errors.ts";
import { requireUserId, authErrorResponse } from "../_shared/auth.ts";
import { loadParties, notify, postOrderChat, type OrderParties } from "../_shared/notify.ts";
import { refundOrder, releaseOrder } from "../_shared/order-money.ts";
import { alertAdmins } from "../_shared/admin-alerts.ts";
import {
    startTimer, endTimers, getActiveTimer, setting,
    shipClock, extendShipClock, deliverClock, deliverCheckins, releaseClock,
} from "../_shared/timers.ts";
import { addHours, formatKenyaTime, isPaused } from "../_shared/business-hours.ts";
import { getNightPause } from "../_shared/timers.ts";
import {
    openDispute, escalateDispute, closeDispute, disputeNote, CATEGORY_LABEL, type DisputeCategory,
} from "../_shared/disputes.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ksh = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;

function generateOtp(): string {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return (100000 + (arr[0] % 900000)).toString();
}

interface Ctx {
    supabase: SupabaseClient;
    userId: string;
    role: "buyer" | "vendor";
    order: Record<string, any>;
    p: OrderParties;
    body: Record<string, any>;
}

function requireRole(ctx: Ctx, role: "buyer" | "vendor") {
    if (ctx.role !== role) throw new UserError(`Only the ${role} can do this.`);
}

function requireStatus(ctx: Ctx, ...statuses: string[]) {
    if (!statuses.includes(ctx.order.status)) {
        throw new UserError("This order has moved on since you opened it. Refresh and try again.");
    }
}

const isPickup = (ctx: Ctx) => ctx.order.order_shipping_details?.delivery_type === "pickup";

async function loadDispute(ctx: Ctx) {
    const { data } = await ctx.supabase.from("disputes").select("*").eq("order_id", ctx.order.id).maybeSingle();
    if (!data || data.status.startsWith("resolved") || data.status === "closed") {
        throw new UserError("There's no open problem report on this order.");
    }
    return data;
}

// ═══ Vendor actions ═════════════════════════════════════════════════════════

async function accept(ctx: Ctx) {
    requireRole(ctx, "vendor");
    requireStatus(ctx, "pending_vendor_confirmation");
    const confirmHours = await setting(ctx.supabase, "vendor_confirm_hours", 48);
    if (Date.now() - new Date(ctx.order.created_at).getTime() > confirmHours * 3600_000) {
        throw new UserError("This order has expired and is being refunded to the buyer.");
    }

    const now = new Date();
    const { data: claimed } = await ctx.supabase.from("orders")
        .update({ status: "accepted", accepted_at: now.toISOString() })
        .eq("id", ctx.order.id).eq("status", "pending_vendor_confirmation")
        .select("id").maybeSingle();
    if (!claimed) throw new UserError("This order has moved on since you opened it. Refresh and try again.");

    let shipBy: string | null = null;
    if (!isPickup(ctx)) {
        const clock = await shipClock(ctx.supabase, now);
        await startTimer(ctx.supabase, ctx.order.id, "ship", clock.due, { schedule: clock.schedule });
        shipBy = clock.due.toISOString();
    }

    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-buyer-order-accepted`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ orderId: ctx.order.id }),
    }).catch((e) => console.error("[Order Action] notify-buyer-order-accepted failed:", e));

    return { shipBy };
}

async function decline(ctx: Ctx) {
    requireRole(ctx, "vendor");
    requireStatus(ctx, "pending_vendor_confirmation", "accepted");
    const reason = String(ctx.body.reason ?? "").slice(0, 200);

    await ctx.supabase.from("orders").update({ cancelled_at: new Date().toISOString() }).eq("id", ctx.order.id);
    // A11: instant full refund. No strike - the vendor said why.
    await refundOrder(ctx.supabase, ctx.order.id, { reason: "vendor_cancelled", finalStatus: "cancelled_by_vendor" });

    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-buyer-order-declined`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ orderId: ctx.order.id, reason, isAutoDeclined: false }),
    }).catch((e) => console.error("[Order Action] notify-buyer-order-declined failed:", e));

    return {};
}

async function submitChecklist(ctx: Ctx) {
    requireRole(ctx, "vendor");
    requireStatus(ctx, "accepted");

    const description = String(ctx.body.description ?? "").trim().slice(0, 500);
    if (description.length < 3) throw new UserError("Add a short description of what's in the package.");

    const items = (ctx.order.order_items ?? []) as any[];
    const ticked = new Set<string>(Array.isArray(ctx.body.checkedItemIds) ? ctx.body.checkedItemIds : []);
    if (items.some((i) => !ticked.has(i.id))) {
        throw new UserError("Tick every item once it's in the package. If something's out of stock, cancel the order instead.");
    }

    const lines = items.map((i) => {
        const snap = (i.product_snapshot ?? {}) as Record<string, unknown>;
        return {
            order_item_id: i.id,
            name: i.product_name,
            quantity: i.quantity,
            size: (snap.size as string) ?? null,
            color: (i.color as string) ?? (snap.color as string) ?? null,
        };
    });

    const { error } = await ctx.supabase.from("order_packing_checklists").upsert({
        order_id: ctx.order.id,
        items: lines,
        description,
        photo_path: typeof ctx.body.photoPath === "string" ? ctx.body.photoPath : null,
        confirmed_at: new Date().toISOString(),
        buyer_status: "pending",
        buyer_note: null,
        buyer_responded_at: null,
        updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Couldn't save checklist: ${error.message}`);
    await endTimers(ctx.supabase, ctx.order.id, ["checklist_hold"], "done");

    const summary = lines.map((l) =>
        `• ${l.quantity}× ${l.name}${l.size ? `, size ${l.size}` : ""}${l.color ? `, ${l.color}` : ""}`).join("\n");

    await postOrderChat(ctx.supabase, ctx.p, "vendor",
        `📦 Packed for order #${ctx.p.shortId}:\n${summary}\n"${description}"\n\nNot what you ordered? Tap "This is wrong" on your order before it ships.`,
        { kind: "packing_checklist" });
    await notify(ctx.supabase, ctx.p, "buyer", {
        subject: `Check what's being sent: order #${ctx.p.shortId}`,
        lines: [
            `${ctx.p.storeName} has packed your order:`,
            ...lines.map((l) => `${l.quantity}× ${l.name}${l.size ? `, size ${l.size}` : ""}${l.color ? `, ${l.color}` : ""}`),
            `"${description}"`,
            "If this isn't what you ordered, open your order and tap \"This is wrong\" so it isn't shipped.",
        ],
        ctaLabel: "Check my order",
        push: true,
    });
    return {};
}

async function ship(ctx: Ctx) {
    requireRole(ctx, "vendor");
    requireStatus(ctx, "accepted");
    const now = new Date();
    const pickup = isPickup(ctx);

    if (!pickup) {
        const { data: checklist } = await ctx.supabase
            .from("order_packing_checklists").select("buyer_status").eq("order_id", ctx.order.id).maybeSingle();
        if (!checklist) throw new UserError("Confirm what's in the package first.");
        if (checklist.buyer_status === "objected") {
            throw new UserError("The buyer says this isn't what they ordered. Check the chat and fix the package list before shipping.");
        }
    }

    const selfDelivery = !!ctx.body.selfDelivery;
    const courier = String(ctx.body.courier ?? "").trim().slice(0, 80);
    const tracking = String(ctx.body.tracking ?? "").trim().slice(0, 80);
    const notes = String(ctx.body.notes ?? "").trim().slice(0, 300);

    await ctx.supabase.from("order_shipping_details").update({
        courier_name: pickup ? "Customer Pickup" : selfDelivery ? "Personal Delivery (Vendor)" : courier || "Rider",
        tracking_number: pickup ? "N/A" : selfDelivery ? "Self-Delivered" : tracking || null,
        ...(notes ? { delivery_notes: notes } : {}),
    }).eq("order_id", ctx.order.id);

    await endTimers(ctx.supabase, ctx.order.id, ["ship"], "done");

    if (pickup) {
        // Ready for pickup: the buyer collects and either taps "Yes, I got
        // it" or gives the vendor the code. No auto-release for pickups.
        await ctx.supabase.from("orders").update({
            status: "arrived", shipped_at: now.toISOString(), vendor_confirmed: true,
            delivery_otp: generateOtp(), otp_generated_at: now.toISOString(),
        }).eq("id", ctx.order.id).eq("status", "accepted");
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-buyer-pickup-ready`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ orderId: ctx.order.id }),
        }).catch((e) => console.error("[Order Action] notify-buyer-pickup-ready failed:", e));
        return {};
    }

    await ctx.supabase.from("orders").update({ status: "shipped", shipped_at: now.toISOString() })
        .eq("id", ctx.order.id).eq("status", "accepted");

    const clock = await deliverClock(ctx.supabase, ctx.order.id, now);
    await startTimer(ctx.supabase, ctx.order.id, "deliver", clock.due, { schedule: clock.schedule, meta: { window_hours: clock.hours } });

    await notify(ctx.supabase, ctx.p, "buyer", {
        subject: `Your order #${ctx.p.shortId} is on the way`,
        lines: [
            `${ctx.p.storeName} has sent your order.`,
            `It should reach you by ${formatKenyaTime(clock.due)}.`,
            "When it arrives, check it first, then tap \"Yes, I got it\" on your order.",
        ],
        ctaLabel: "Track my order",
        push: true,
    });
    return { deliverBy: clock.due.toISOString() };
}

async function arrived(ctx: Ctx) {
    requireRole(ctx, "vendor");
    requireStatus(ctx, "shipped");
    const now = new Date();
    const otp = ctx.order.delivery_otp ?? generateOtp();

    const { data: claimed } = await ctx.supabase.from("orders").update({
        status: "arrived", vendor_confirmed: true, delivered_at: now.toISOString(),
        delivery_otp: otp, otp_generated_at: ctx.order.otp_generated_at ?? now.toISOString(),
    }).eq("id", ctx.order.id).eq("status", "shipped").select("id").maybeSingle();
    if (!claimed) throw new UserError("This order has moved on since you opened it. Refresh and try again.");

    await endTimers(ctx.supabase, ctx.order.id, ["deliver", "buyer_unavailable"], "done");
    const clock = await releaseClock(ctx.supabase, now);
    await startTimer(ctx.supabase, ctx.order.id, "release", clock.due, { schedule: clock.schedule });
    await ctx.supabase.from("orders").update({ auto_release_at: clock.due.toISOString() }).eq("id", ctx.order.id);

    await notify(ctx.supabase, ctx.p, "buyer", {
        subject: `Did you get your order #${ctx.p.shortId}?`,
        lines: [
            `${ctx.p.storeName} says your order has arrived.`,
            "Check it, then open your order and tap \"Yes, I got it\". If something's wrong or it didn't arrive, tap \"Something wrong?\" and we'll hold the payment.",
            `Your delivery code is ${otp}. Only give it to the rider after you've checked the item: it pays the seller.`,
            `If we don't hear from you, the seller is paid ${formatKenyaTime(clock.due)}.`,
        ],
        ctaLabel: "Confirm my order",
        push: true,
        sms: `Solely: ${ctx.p.storeName} says order #${ctx.p.shortId} arrived. Got it? Confirm or report a problem before ${formatKenyaTime(clock.due)}: solelymarketplace.com/orders`,
    });
    return { releaseAt: clock.due.toISOString() };
}

async function sendUpdate(ctx: Ctx) {
    requireRole(ctx, "vendor");
    const message = String(ctx.body.message ?? "").trim().slice(0, 500);
    if (message.length < 3) throw new UserError("Write a short update for the buyer.");

    await postOrderChat(ctx.supabase, ctx.p, "vendor", `🚚 Update on order #${ctx.p.shortId}: ${message}`, { kind: "delivery_update" });
    await notify(ctx.supabase, ctx.p, "buyer", {
        subject: `Update on your order #${ctx.p.shortId}`,
        lines: [`${ctx.p.storeName} says:`, `"${message}"`],
        push: true,
    });

    // A reply buys time on whichever clock is running (A1 or A4); once the
    // allowed extensions are used up, Solely steps in instead.
    const kind = ctx.order.status === "accepted" ? "ship" : ctx.order.status === "shipped" ? "deliver" : null;
    if (!kind) return { extended: false };
    const timer = await getActiveTimer(ctx.supabase, ctx.order.id, kind);
    if (!timer) return { extended: false };

    const max = await setting(ctx.supabase, kind === "ship" ? "ship_max_extensions" : "deliver_max_extensions", kind === "ship" ? 2 : 3);
    if (timer.extensions >= max) {
        await endTimers(ctx.supabase, ctx.order.id, [kind], "escalated");
        const disputeId = await openDispute(ctx.supabase, ctx.p, {
            category: "item_not_received",
            description: `${kind === "ship" ? "Not shipped" : "Not delivered"} after ${timer.extensions} updates from the vendor. Latest update: "${message}"`,
            raisedBy: "system",
            stage: "with_admin",
        });
        await disputeNote(ctx.supabase, disputeId, ctx.p.vendorId, "vendor", message);
        return { extended: false, escalated: true };
    }

    let due: Date, schedule: Date[];
    if (kind === "ship") {
        ({ due, schedule } = await extendShipClock(ctx.supabase, new Date(timer.due_at)));
    } else {
        const ext = await setting(ctx.supabase, "deliver_extension_hours", 24);
        due = addHours(new Date(timer.due_at), ext);
        schedule = await deliverCheckins(ctx.supabase, due);
    }
    await startTimer(ctx.supabase, ctx.order.id, kind, due, { schedule, meta: timer.meta, extensions: timer.extensions + 1 });
    return { extended: true, newDeadline: due.toISOString(), extensionsLeft: max - timer.extensions - 1 };
}

async function buyerUnavailable(ctx: Ctx) {
    requireRole(ctx, "vendor");
    requireStatus(ctx, "shipped", "arrived");
    if (isPickup(ctx)) throw new UserError("This is a pickup order.");
    if (await getActiveTimer(ctx.supabase, ctx.order.id, "buyer_unavailable")) {
        throw new UserError("You've already reported this. Solely is contacting the buyer.");
    }

    const { count: previous } = await ctx.supabase.from("order_timers")
        .select("id", { count: "exact", head: true })
        .eq("order_id", ctx.order.id).eq("kind", "buyer_unavailable");
    const attempt = (previous ?? 0) + 1;
    const note = String(ctx.body.note ?? "").trim().slice(0, 300);

    // While the rider is at the door, the vendor can't be refunded for lateness.
    await endTimers(ctx.supabase, ctx.order.id, ["deliver", "release"], "cancelled");
    const grace = await setting(ctx.supabase, "buyer_unavailable_grace_hours", 12);
    const due = addHours(new Date(), grace);
    await startTimer(ctx.supabase, ctx.order.id, "buyer_unavailable", due, { meta: { attempt, note } });

    await notify(ctx.supabase, ctx.p, "buyer", {
        subject: `The seller can't reach you: order #${ctx.p.shortId}`,
        lines: [
            `${ctx.p.storeName}'s rider is trying to deliver your order and can't reach you.${note ? ` They said: "${note}"` : ""}`,
            "Call the seller now, or open your order and tap \"I'm available\".",
            `If we don't hear from you by ${formatKenyaTime(due)}, the order is cancelled and you're refunded the item price. The delivery fee goes to the seller.`,
        ],
        ctaLabel: "I'm available",
        push: true,
        sms: `Solely: ${ctx.p.storeName}'s rider can't reach you for order #${ctx.p.shortId}. Call them now or open your Solely order.`,
    });
    await alertAdmins(ctx.supabase, `Call the buyer now: order #${ctx.p.shortId}`,
        "The vendor says the buyer is unavailable at delivery. Call the buyer within 10-15 minutes. If the buyer was actually there, reject the claim in Admin > Disputes (this gives the vendor a strike).",
        { Order: ctx.order.id, Attempt: attempt, Buyer: ctx.p.buyerName, "Buyer phone": ctx.p.buyerPhone ?? "-", Store: ctx.p.storeName, "Vendor phone": ctx.p.vendorPhone ?? "-", "Vendor note": note || "-" });

    const pause = await getNightPause(ctx.supabase);
    const supportHours = await setting(ctx.supabase, "support_hours", "08:00-17:00");
    const [open, close] = supportHours.split("-");
    const localHour = new Date(Date.now() + 3 * 3600_000).getUTCHours();
    const inSupport = localHour >= Number(open.split(":")[0]) && localHour < Number(close.split(":")[0]) && !isPaused(new Date(), pause);
    return {
        message: inSupport
            ? "Please wait a little longer. Solely is calling the buyer now."
            : `Solely will call the buyer when support opens at ${open}. The buyer has until ${formatKenyaTime(due)} to respond.`,
    };
}

// ═══ Buyer actions ══════════════════════════════════════════════════════════

async function confirmReceived(ctx: Ctx) {
    requireRole(ctx, "buyer");
    requireStatus(ctx, "shipped", "arrived", "delivered");
    const result = await releaseOrder(ctx.supabase, ctx.order.id, { note: "Buyer confirmed receipt" });
    return { released: result.released };
}

async function reportProblem(ctx: Ctx) {
    requireRole(ctx, "buyer");
    requireStatus(ctx, "shipped", "arrived", "delivered");

    const category = String(ctx.body.category) as DisputeCategory;
    if (!(category in CATEGORY_LABEL)) throw new UserError("Choose what went wrong.");
    const description = String(ctx.body.description ?? "").trim().slice(0, 2000);
    const evidence = (Array.isArray(ctx.body.evidence) ? ctx.body.evidence : []).filter((x: unknown) => typeof x === "string").slice(0, 8);

    const itemIds = new Set(((ctx.order.order_items ?? []) as any[]).map((i) => i.id));
    const missingItemIds = category === "missing_items"
        ? (Array.isArray(ctx.body.missingItemIds) ? ctx.body.missingItemIds : []).filter((id: string) => itemIds.has(id))
        : [];
    if (category === "missing_items" && missingItemIds.length === 0) throw new UserError("Tick the items that are missing.");
    if (category !== "missing_items" && description.length < 5) throw new UserError("Tell us a little about what happened.");

    const route: Record<DisputeCategory, "negotiating" | "awaiting_fix" | "with_admin"> = {
        item_not_received: "with_admin",
        not_as_advertised: "negotiating",
        item_broken: "negotiating",
        wrong_item: "negotiating",
        missing_items: "awaiting_fix",
        wrong_order: "awaiting_fix",
        other: "with_admin",
    };
    const stage = route[category];

    const disputeId = await openDispute(ctx.supabase, ctx.p, {
        category, description: description || CATEGORY_LABEL[category], raisedBy: "buyer", stage, evidence, missingItemIds,
    });
    if (description) await disputeNote(ctx.supabase, disputeId, ctx.userId, "buyer", description);

    const now = new Date();
    let vendorLines: string[];
    let buyerNext: string;

    if (stage === "negotiating") {
        const hours = await setting(ctx.supabase, "vendor_response_hours", 48);
        const due = addHours(now, hours);
        await startTimer(ctx.supabase, ctx.order.id, "vendor_response", due);
        vendorLines = [
            `The buyer reported a problem with order #${ctx.p.shortId}: ${CATEGORY_LABEL[category]}.`,
            description ? `"${description}"` : "",
            `Open the order and offer a fix: a partial refund, a replacement, or a full refund once you collect the item. You cover any delivery costs. If you don't respond by ${formatKenyaTime(due)}, the buyer is refunded in full.`,
        ];
        buyerNext = `We've asked ${ctx.p.storeName} to offer you a fix. If they don't respond by ${formatKenyaTime(due)}, you'll be refunded in full.`;
    } else if (stage === "awaiting_fix") {
        const key = category === "missing_items" ? "missing_items_fix_hours" : "wrong_order_fix_hours";
        const hours = await setting(ctx.supabase, key, category === "missing_items" ? 36 : 24);
        const due = addHours(now, hours);
        await startTimer(ctx.supabase, ctx.order.id, "fix", due, { meta: { category } });
        const missingNames = ((ctx.order.order_items ?? []) as any[])
            .filter((i) => missingItemIds.includes(i.id)).map((i) => `${i.quantity}× ${i.product_name}`).join(", ");
        vendorLines = category === "missing_items"
            ? [`The buyer says these items were missing from order #${ctx.p.shortId}: ${missingNames}.`, `Send them by ${formatKenyaTime(due)} at your own cost, then tap "I've sent it" on the order.`]
            : [`The buyer received someone else's order instead of #${ctx.p.shortId}.`, `Swap the packages by ${formatKenyaTime(due)}, then tap "I've sent it" on the order. Otherwise the buyer is refunded.`];
        buyerNext = category === "missing_items"
            ? `${ctx.p.storeName} has until ${formatKenyaTime(due)} to send the missing items. If they don't, you can choose a refund for them.`
            : `${ctx.p.storeName} has until ${formatKenyaTime(due)} to bring your correct order. If you'd rather have your money back now, tap "Refund me instead".`;
    } else {
        vendorLines = [`The buyer reported a problem with order #${ctx.p.shortId}: ${CATEGORY_LABEL[category]}.`, description ? `"${description}"` : "", "Solely's team will contact you. Reply in the order's dispute chat with your side."];
        buyerNext = "Solely's team will look into it and contact you, usually within one working day. Your payment stays held until then.";
    }

    await notify(ctx.supabase, ctx.p, "vendor", {
        subject: `Problem reported on order #${ctx.p.shortId}`,
        lines: vendorLines.filter(Boolean),
        ctaLabel: "Open the order",
        push: true,
        sms: `Solely: the buyer reported a problem with order #${ctx.p.shortId}. Open your orders to respond.`,
    });
    await notify(ctx.supabase, ctx.p, "buyer", {
        subject: `We've got your report: order #${ctx.p.shortId}`,
        lines: ["Your payment is held and the seller hasn't been paid.", buyerNext],
    });
    return { disputeId, next: buyerNext };
}

async function respondChecklist(ctx: Ctx) {
    requireRole(ctx, "buyer");
    requireStatus(ctx, "accepted");
    const approve = !!ctx.body.approve;
    const note = String(ctx.body.note ?? "").trim().slice(0, 300);

    const { data: updated } = await ctx.supabase.from("order_packing_checklists").update({
        buyer_status: approve ? "approved" : "objected",
        buyer_note: note || null,
        buyer_responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq("order_id", ctx.order.id).select("order_id").maybeSingle();
    if (!updated) throw new UserError("The seller hasn't packed this order yet.");

    if (approve) {
        await endTimers(ctx.supabase, ctx.order.id, ["checklist_hold"], "done");
        return {};
    }

    const hours = await setting(ctx.supabase, "checklist_hold_hours", 2);
    const due = addHours(new Date(), hours);
    await startTimer(ctx.supabase, ctx.order.id, "checklist_hold", due);
    await postOrderChat(ctx.supabase, ctx.p, "buyer",
        `⚠️ This isn't what I ordered (order #${ctx.p.shortId})${note ? `: ${note}` : "."}`, { kind: "checklist_objection" });
    await notify(ctx.supabase, ctx.p, "vendor", {
        subject: `Hold on: the buyer says order #${ctx.p.shortId} is wrong`,
        lines: [
            `The buyer says the package doesn't match what they ordered${note ? `: "${note}"` : "."}`,
            "Shipping is paused. Check the chat or call the buyer, then update the package list on the order.",
            `If the buyer doesn't reply, you can ship after ${formatKenyaTime(due)}.`,
        ],
        push: true,
        sms: `Solely: buyer says order #${ctx.p.shortId} is packed wrong. Don't ship yet. Check your Solely chat.`,
    });
    return { blockedUntil: due.toISOString() };
}

// ═══ Disputes: offers, returns, fixes ═══════════════════════════════════════

const OFFER_TEXT = (kind: string, amount?: number | null) =>
    kind === "partial_refund" ? `a partial refund of ${ksh(Number(amount))} (you keep the item)`
        : kind === "replacement" ? "a replacement (the seller collects the item and sends the right one)"
            : "a full refund (the seller collects the item first)";

async function makeOffer(ctx: Ctx) {
    const dispute = await loadDispute(ctx);
    if (dispute.stage !== "negotiating") throw new UserError("Offers can only be made while you're working it out together.");
    const kind = String(ctx.body.kind);
    if (!["partial_refund", "replacement", "refund_with_return"].includes(kind)) throw new UserError("Choose an offer type.");

    let amount: number | null = null;
    if (kind === "partial_refund") {
        amount = Math.round(Number(ctx.body.amount));
        const max = Number(ctx.order.subtotal_ksh) - Number(ctx.order.refunded_ksh ?? 0);
        if (!(amount > 0) || amount >= max) throw new UserError(`Enter an amount between 1 and ${ksh(max - 1)}. For the full price, offer a full refund instead.`);
    }
    const note = String(ctx.body.note ?? "").trim().slice(0, 300) || null;

    await ctx.supabase.from("dispute_offers").update({ status: "withdrawn" })
        .eq("dispute_id", dispute.id).eq("made_by", ctx.role).eq("status", "pending");
    const { error } = await ctx.supabase.from("dispute_offers").insert({
        dispute_id: dispute.id, made_by: ctx.role, kind, amount_ksh: amount, note,
    });
    if (error) throw new Error(`Couldn't save offer: ${error.message}`);

    await endTimers(ctx.supabase, ctx.order.id, ["vendor_response"], "done");
    if (!(await getActiveTimer(ctx.supabase, ctx.order.id, "negotiation"))) {
        const hours = await setting(ctx.supabase, "negotiation_hours", 48);
        await startTimer(ctx.supabase, ctx.order.id, "negotiation", addHours(new Date(), hours));
    }

    const who = ctx.role === "vendor" ? ctx.p.storeName : "The buyer";
    await disputeNote(ctx.supabase, dispute.id, ctx.userId, ctx.role, `Offer: ${OFFER_TEXT(kind, amount)}${note ? `. ${note}` : ""}`);
    await notify(ctx.supabase, ctx.p, ctx.role === "vendor" ? "buyer" : "vendor", {
        subject: `New offer on order #${ctx.p.shortId}`,
        lines: [`${who} offered ${OFFER_TEXT(kind, amount)}.`, note ? `"${note}"` : "", "Open the order to accept or decline."].filter(Boolean),
        ctaLabel: "See the offer",
        push: true,
    });
    return {};
}

async function respondOffer(ctx: Ctx) {
    const dispute = await loadDispute(ctx);
    const { data: offer } = await ctx.supabase.from("dispute_offers")
        .select("*").eq("id", ctx.body.offerId).eq("dispute_id", dispute.id).maybeSingle();
    if (!offer || offer.status !== "pending") throw new UserError("This offer is no longer open.");
    if (offer.made_by === ctx.role) throw new UserError("You can't respond to your own offer.");

    const accept = !!ctx.body.accept;
    const { data: claimed } = await ctx.supabase.from("dispute_offers")
        .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
        .eq("id", offer.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) throw new UserError("This offer is no longer open.");

    const other = ctx.role === "vendor" ? "buyer" : "vendor";
    if (!accept) {
        await disputeNote(ctx.supabase, dispute.id, ctx.userId, ctx.role, "Declined the offer.");
        await notify(ctx.supabase, ctx.p, other, {
            subject: `Offer declined on order #${ctx.p.shortId}`,
            lines: ["Your offer was declined. You can make another one, or tap \"Ask Solely to decide\"."],
        });
        return {};
    }

    await endTimers(ctx.supabase, ctx.order.id, ["negotiation", "vendor_response"], "done");
    await ctx.supabase.from("disputes").update({ accepted_offer_id: offer.id }).eq("id", dispute.id);
    await disputeNote(ctx.supabase, dispute.id, ctx.userId, ctx.role, `Accepted: ${OFFER_TEXT(offer.kind, offer.amount_ksh)}.`);

    if (offer.kind === "partial_refund") {
        await refundOrder(ctx.supabase, ctx.order.id, { amount: Number(offer.amount_ksh), reason: dispute.dispute_type ?? "other" });
        await releaseOrder(ctx.supabase, ctx.order.id, { note: `Dispute settled with a partial refund of ${offer.amount_ksh}` });
        await closeDispute(ctx.supabase, dispute.id, "split", `Settled: partial refund of ${offer.amount_ksh}`);
        const lines = [`Agreed: ${OFFER_TEXT(offer.kind, offer.amount_ksh)}.`, "The refund is on its way to the buyer, and the rest has been released to the seller."];
        await notify(ctx.supabase, ctx.p, "buyer", { subject: `Sorted: order #${ctx.p.shortId}`, lines });
        await notify(ctx.supabase, ctx.p, "vendor", { subject: `Sorted: order #${ctx.p.shortId}`, lines });
        return {};
    }

    if (offer.kind === "replacement") {
        const hours = await setting(ctx.supabase, "replacement_fix_hours", 48);
        const due = addHours(new Date(), hours);
        await ctx.supabase.from("disputes").update({ stage: "awaiting_fix" }).eq("id", dispute.id);
        await startTimer(ctx.supabase, ctx.order.id, "fix", due, { meta: { category: "replacement" } });
        await notify(ctx.supabase, ctx.p, "vendor", {
            subject: `Replacement agreed: order #${ctx.p.shortId}`,
            lines: [`Collect the item from the buyer and send the replacement by ${formatKenyaTime(due)}, at your cost. Then tap "I've sent it" on the order.`, "If it isn't sent in time, the buyer is refunded in full."],
            push: true,
        });
        await notify(ctx.supabase, ctx.p, "buyer", {
            subject: `Replacement agreed: order #${ctx.p.shortId}`,
            lines: [`${ctx.p.storeName} will collect the item and send a replacement by ${formatKenyaTime(due)}.`, "Hand the item to their rider when they come."],
        });
        return {};
    }

    // refund_with_return
    await ctx.supabase.from("disputes").update({ stage: "awaiting_return" }).eq("id", dispute.id);
    await notify(ctx.supabase, ctx.p, "vendor", {
        subject: `Return agreed: order #${ctx.p.shortId}`,
        lines: ["Send your rider to collect the item from the buyer, at your cost. Once it's back with you, tap \"I got it back\" and the buyer is refunded."],
        push: true,
    });
    await notify(ctx.supabase, ctx.p, "buyer", {
        subject: `Return agreed: order #${ctx.p.shortId}`,
        lines: [`${ctx.p.storeName} will send someone to collect the item. When you hand it over, tap "I've handed it back" on your order.`, "You're refunded in full once the seller confirms, or automatically if they don't respond in time."],
    });
    return {};
}

async function handedBack(ctx: Ctx) {
    requireRole(ctx, "buyer");
    const dispute = await loadDispute(ctx);
    if (dispute.stage !== "awaiting_return") throw new UserError("There's no return waiting on this order.");
    const note = String(ctx.body.note ?? "").trim().slice(0, 300) || null;

    const hours = await setting(ctx.supabase, "return_confirm_hours", 48);
    const due = addHours(new Date(), hours);
    await ctx.supabase.from("disputes").update({
        stage: "return_handed", return_handed_at: new Date().toISOString(), return_note: note,
        buyer_evidence_urls: typeof ctx.body.photoPath === "string"
            ? [...(dispute.buyer_evidence_urls ?? []), ctx.body.photoPath] : dispute.buyer_evidence_urls,
    }).eq("id", dispute.id);
    await startTimer(ctx.supabase, ctx.order.id, "return_confirm", due);
    await disputeNote(ctx.supabase, dispute.id, ctx.userId, "buyer", `I've handed the item back.${note ? ` ${note}` : ""}`);

    await notify(ctx.supabase, ctx.p, "vendor", {
        subject: `Item handed back: order #${ctx.p.shortId}`,
        lines: [`The buyer says they handed the item back${note ? ` (${note})` : ""}.`, `Tap "I got it back" once you have it. If you don't respond by ${formatKenyaTime(due)}, the buyer is refunded automatically.`],
        push: true,
    });
    return { refundBy: due.toISOString() };
}

async function confirmReturn(ctx: Ctx) {
    requireRole(ctx, "vendor");
    const dispute = await loadDispute(ctx);
    if (!["awaiting_return", "return_handed"].includes(dispute.stage)) throw new UserError("There's no return waiting on this order.");

    await endTimers(ctx.supabase, ctx.order.id, ["return_confirm"], "done");
    await refundOrder(ctx.supabase, ctx.order.id, { reason: dispute.dispute_type ?? "other" });
    await closeDispute(ctx.supabase, dispute.id, "buyer", "Item returned; buyer refunded in full");
    await notify(ctx.supabase, ctx.p, "buyer", {
        subject: `Refund on its way: order #${ctx.p.shortId}`,
        lines: [`${ctx.p.storeName} confirmed they got the item back. Your full refund is on its way.`],
    });
    return {};
}

async function rejectReturn(ctx: Ctx) {
    requireRole(ctx, "vendor");
    const dispute = await loadDispute(ctx);
    if (dispute.stage !== "return_handed") throw new UserError("There's no handed-back item to dispute.");
    const note = String(ctx.body.note ?? "").trim().slice(0, 300);
    if (note) await disputeNote(ctx.supabase, dispute.id, ctx.userId, "vendor", `I haven't received the item back. ${note}`);
    await escalateDispute(ctx.supabase, ctx.p, dispute.id, `Vendor says the returned item never reached them.${note ? ` "${note}"` : ""}`);
    return {};
}

async function fixSent(ctx: Ctx) {
    requireRole(ctx, "vendor");
    const dispute = await loadDispute(ctx);
    if (dispute.stage !== "awaiting_fix") throw new UserError("There's nothing waiting to be sent on this order.");
    const note = String(ctx.body.note ?? "").trim().slice(0, 300);

    await endTimers(ctx.supabase, ctx.order.id, ["fix"], "done");
    await ctx.supabase.from("disputes").update({ stage: "fix_sent" }).eq("id", dispute.id);
    // If the buyer never confirms, treat silence like an arrived order.
    const hours = await setting(ctx.supabase, "replacement_fix_hours", 48);
    const due = addHours(new Date(), hours);
    await startTimer(ctx.supabase, ctx.order.id, "release", due, { meta: { after_fix: true } });
    await disputeNote(ctx.supabase, dispute.id, ctx.userId, "vendor", `I've sent it.${note ? ` ${note}` : ""}`);

    await notify(ctx.supabase, ctx.p, "buyer", {
        subject: `On its way: order #${ctx.p.shortId}`,
        lines: [`${ctx.p.storeName} says the fix is on its way${note ? `: "${note}"` : "."}`, "When it arrives, open your order and tell us if it's all good now."],
        ctaLabel: "Open my order",
        push: true,
    });
    return {};
}

async function fixResult(ctx: Ctx) {
    requireRole(ctx, "buyer");
    const dispute = await loadDispute(ctx);
    if (dispute.stage !== "fix_sent") throw new UserError("There's nothing to confirm on this order.");

    if (ctx.body.ok) {
        await releaseOrder(ctx.supabase, ctx.order.id, { note: "Buyer confirmed the fix" });
        await closeDispute(ctx.supabase, dispute.id, "none", "Vendor fixed the order; buyer confirmed");
        await notify(ctx.supabase, ctx.p, "vendor", { subject: `Sorted: order #${ctx.p.shortId}`, lines: ["The buyer confirmed everything's fine now. Your payment has been released."] });
        return {};
    }
    const note = String(ctx.body.note ?? "").trim().slice(0, 300);
    if (note) await disputeNote(ctx.supabase, dispute.id, ctx.userId, "buyer", `Still not right: ${note}`);
    await escalateDispute(ctx.supabase, ctx.p, dispute.id, `Buyer says the fix didn't solve it.${note ? ` "${note}"` : ""}`);
    return {};
}

async function missingChoice(ctx: Ctx) {
    requireRole(ctx, "buyer");
    const dispute = await loadDispute(ctx);
    if (dispute.stage !== "buyer_choice") throw new UserError("There's no choice waiting on this order.");

    if (ctx.body.choice === "refund") {
        const missing = new Set<string>(dispute.missing_item_ids ?? []);
        const amount = ((ctx.order.order_items ?? []) as any[])
            .filter((i) => missing.has(i.id))
            .reduce((sum, i) => sum + Number(i.unit_price_ksh) * Number(i.quantity), 0);
        if (amount > 0) await refundOrder(ctx.supabase, ctx.order.id, { amount, reason: "missing_items" });
        await releaseOrder(ctx.supabase, ctx.order.id, { note: "Missing items refunded; remainder released" });
        await closeDispute(ctx.supabase, dispute.id, "buyer", `Missing items refunded (${amount})`);
        await notify(ctx.supabase, ctx.p, "vendor", {
            subject: `Missing items refunded: order #${ctx.p.shortId}`,
            lines: [`The missing items weren't sent in time, so the buyer was refunded ${ksh(amount)} for them. The rest of the order has been released to you.`],
        });
        return { refunded: amount };
    }

    await releaseOrder(ctx.supabase, ctx.order.id, { note: "Buyer accepted order without missing items" });
    await closeDispute(ctx.supabase, dispute.id, "none", "Buyer chose to keep the order as it is");
    return {};
}

async function refundNow(ctx: Ctx) {
    requireRole(ctx, "buyer");
    const dispute = await loadDispute(ctx);
    if (!(dispute.dispute_type === "wrong_order" && dispute.stage === "awaiting_fix")) {
        throw new UserError("An instant refund isn't available for this problem.");
    }
    await endTimers(ctx.supabase, ctx.order.id, ["fix"], "done");
    await refundOrder(ctx.supabase, ctx.order.id, { reason: "wrong_order" });
    await closeDispute(ctx.supabase, dispute.id, "buyer", "Buyer received someone else's order and chose a refund");
    await notify(ctx.supabase, ctx.p, "vendor", {
        subject: `Refunded: order #${ctx.p.shortId}`,
        lines: ["The buyer received someone else's order and chose a full refund. Please collect that package from them."],
        push: true,
    });
    return {};
}

async function unavailableReply(ctx: Ctx) {
    requireRole(ctx, "buyer");
    const timer = await getActiveTimer(ctx.supabase, ctx.order.id, "buyer_unavailable");
    if (!timer) throw new UserError("There's nothing to reply to on this order.");
    const message = String(ctx.body.message ?? "").trim().slice(0, 300);

    await ctx.supabase.from("order_timers")
        .update({ status: "done", resolved_at: new Date().toISOString(), meta: { ...timer.meta, buyer_replied: message || true } })
        .eq("id", timer.id);
    // Fresh delivery window for the second attempt.
    if (ctx.order.status === "shipped") {
        const clock = await deliverClock(ctx.supabase, ctx.order.id, new Date(), 24);
        await startTimer(ctx.supabase, ctx.order.id, "deliver", clock.due, { schedule: clock.schedule });
    } else if (ctx.order.status === "arrived") {
        const clock = await releaseClock(ctx.supabase, new Date());
        await startTimer(ctx.supabase, ctx.order.id, "release", clock.due, { schedule: clock.schedule });
    }

    await postOrderChat(ctx.supabase, ctx.p, "buyer", `🙋 I'm available for delivery of order #${ctx.p.shortId}.${message ? ` ${message}` : ""}`, { kind: "unavailable_reply" });
    await notify(ctx.supabase, ctx.p, "vendor", {
        subject: `The buyer is available: order #${ctx.p.shortId}`,
        lines: [`The buyer responded${message ? `: "${message}"` : "."}`, "Arrange the delivery again. If they're unavailable a second time, report it again."],
        push: true,
        sms: `Solely: buyer for order #${ctx.p.shortId} is available now. Check your Solely chat.`,
    });
    return {};
}

// ═══ Either party ═══════════════════════════════════════════════════════════

async function escalate(ctx: Ctx) {
    const dispute = await loadDispute(ctx);
    const note = String(ctx.body.note ?? "").trim().slice(0, 300);
    if (note) await disputeNote(ctx.supabase, dispute.id, ctx.userId, ctx.role, note);
    await escalateDispute(ctx.supabase, ctx.p, dispute.id, `The ${ctx.role} asked Solely to decide.${note ? ` "${note}"` : ""}`);
    return {};
}

async function appeal(ctx: Ctx) {
    const { data: dispute } = await ctx.supabase.from("disputes").select("*").eq("order_id", ctx.order.id).maybeSingle();
    if (!dispute || !dispute.resolved_at) throw new UserError("There's no decision to appeal on this order.");
    if (dispute.resolved_by) throw new UserError("This was decided by Solely's team. Contact support if you disagree.");
    if (dispute.appeal_requested_at) throw new UserError("You've already asked Solely to review this.");
    const hours = await setting(ctx.supabase, "appeal_window_hours", 48);
    if (Date.now() - new Date(dispute.resolved_at).getTime() > hours * 3600_000) {
        throw new UserError("The time to ask for a review has passed. Contact support if you need help.");
    }
    const note = String(ctx.body.note ?? "").trim().slice(0, 500);
    await ctx.supabase.from("disputes").update({ appeal_requested_at: new Date().toISOString(), appeal_requested_by: ctx.role }).eq("id", dispute.id);
    if (note) await disputeNote(ctx.supabase, dispute.id, ctx.userId, ctx.role, `Review requested: ${note}`);
    await alertAdmins(ctx.supabase, `Review requested: order #${ctx.p.shortId}`,
        `The ${ctx.role} disagrees with an automatic decision.`,
        { Order: ctx.order.id, Decision: dispute.resolution_notes ?? "-", "Their reason": note || "-" });
    return {};
}

// ═══ Dispatch ═══════════════════════════════════════════════════════════════

const ACTIONS: Record<string, (ctx: Ctx) => Promise<Record<string, unknown>>> = {
    accept, decline, submit_checklist: submitChecklist, ship, arrived, send_update: sendUpdate,
    buyer_unavailable: buyerUnavailable, make_offer: makeOffer, fix_sent: fixSent,
    confirm_return: confirmReturn, reject_return: rejectReturn,
    confirm_received: confirmReceived, report_problem: reportProblem, respond_checklist: respondChecklist,
    respond_offer: respondOffer, handed_back: handedBack, fix_result: fixResult,
    missing_choice: missingChoice, refund_now: refundNow, unavailable_reply: unavailableReply,
    escalate, appeal,
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const userId = await requireUserId(req, supabase);

        const body = await req.json().catch(() => ({}));
        const handler = ACTIONS[body.action];
        if (!handler) return json({ success: false, error: "Unknown action" }, 400);
        if (!body.orderId) return json({ success: false, error: "Missing orderId" }, 400);

        const limited = await rateLimit(req, corsHeaders, { name: "order-action", max: 30, windowSeconds: 300, identity: userId });
        if (limited) return limited;

        const { data: order, error } = await supabase
            .from("orders")
            .select("*, order_items(*), order_shipping_details(*)")
            .eq("id", body.orderId)
            .single();
        if (error || !order) return json({ success: false, error: "Order not found" }, 404);
        if (Array.isArray(order.order_shipping_details)) order.order_shipping_details = order.order_shipping_details[0] ?? null;

        const role = order.vendor_id === userId ? "vendor" : order.customer_id === userId ? "buyer" : null;
        if (!role) return json({ success: false, error: "This isn't your order." }, 403);

        const p = await loadParties(supabase, order.id);
        const result = await handler({ supabase, userId, role, order, p, body });
        return json({ success: true, ...result });
    } catch (err) {
        const unauthorized = authErrorResponse(err, corsHeaders);
        if (unauthorized) return unauthorized;
        if (err instanceof UserError) return json({ success: false, error: err.message }, 409);
        console.error("[Order Action] Error:", err);
        return json({ success: false, error: "Something went wrong on our side. Nothing was charged. Please try again, or contact support." }, 500);
    }
});
