/**
 * Dispute lifecycle helpers shared by order-action (people), order-engine
 * (timers) and resolve-dispute (admins).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alertAdmins } from "./admin-alerts.ts";
import { notify, type OrderParties } from "./notify.ts";
import { recordDisputeOutcome } from "./strikes.ts";
import { endTimers } from "./timers.ts";
import { UserError } from "./errors.ts";

export type DisputeCategory =
    | "item_not_received" | "not_as_advertised" | "item_broken"
    | "wrong_item" | "missing_items" | "wrong_order" | "other";

export type DisputeStage =
    | "negotiating" | "awaiting_fix" | "fix_sent" | "awaiting_return"
    | "return_handed" | "buyer_choice" | "with_admin" | "resolved";

export const CATEGORY_LABEL: Record<DisputeCategory, string> = {
    item_not_received: "Didn't receive the order",
    not_as_advertised: "Not as described",
    item_broken: "Damaged or not working",
    wrong_item: "Wrong item, size or colour",
    missing_items: "Items missing",
    wrong_order: "Received someone else's order",
    other: "Other problem",
};

// The legacy enum column still needs a value.
const LEGACY_REASON: Record<DisputeCategory, string> = {
    item_not_received: "no_delivery",
    not_as_advertised: "other",
    item_broken: "damaged",
    wrong_item: "wrong_item",
    missing_items: "other",
    wrong_order: "wrong_item",
    other: "other",
};

export interface OpenDisputeInput {
    category: DisputeCategory;
    description: string;
    raisedBy: "buyer" | "vendor" | "system";
    stage: DisputeStage;
    evidence?: string[];
    missingItemIds?: string[];
}

/**
 * Opens a dispute and freezes the order. An order has at most one dispute
 * row (disputes.order_id is unique), so a second problem on the same order
 * reopens that row instead of failing.
 */
export async function openDispute(
    supabase: SupabaseClient,
    p: OrderParties,
    input: OpenDisputeInput,
): Promise<string> {
    const now = new Date().toISOString();
    const row = {
        order_id: p.orderId,
        customer_id: p.customerId,
        vendor_id: p.vendorId,
        reason: LEGACY_REASON[input.category],
        dispute_type: input.category,
        description: input.description,
        buyer_evidence_urls: input.evidence?.length ? input.evidence : null,
        missing_item_ids: input.missingItemIds?.length ? input.missingItemIds : null,
        raised_by: input.raisedBy,
        stage: input.stage,
        status: input.stage === "with_admin" ? "under_review" : "open",
        escalated_at: input.stage === "with_admin" ? now : null,
        opened_at: now,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
        outcome: null,
        accepted_offer_id: null,
        appeal_requested_at: null,
        appeal_requested_by: null,
        return_note: null,
        return_handed_at: null,
    };

    const { data: existing } = await supabase.from("disputes").select("id, status").eq("order_id", p.orderId).maybeSingle();
    let disputeId: string;
    if (existing) {
        if (!(existing.status.startsWith("resolved") || existing.status === "closed")) {
            throw new UserError("There's already an open problem report on this order.");
        }
        const { error } = await supabase.from("disputes").update(row).eq("id", existing.id);
        if (error) throw new Error(`Couldn't reopen dispute: ${error.message}`);
        await supabase.from("dispute_offers").update({ status: "expired" }).eq("dispute_id", existing.id).eq("status", "pending");
        disputeId = existing.id;
    } else {
        const { data, error } = await supabase.from("disputes").insert(row).select("id").single();
        if (error || !data) throw new Error(`Couldn't open dispute: ${error?.message}`);
        disputeId = data.id;
    }

    // Freeze the money: no release or delivery clock runs while there's a problem.
    await supabase.from("orders").update({ status: "disputed", dispute_id: disputeId }).eq("id", p.orderId);
    await supabase.from("escrow_transactions").update({ status: "withheld" }).eq("order_id", p.orderId);
    await endTimers(supabase, p.orderId, ["release", "deliver", "ship"], "cancelled");

    if (input.stage === "with_admin") {
        await alertAdmins(supabase, `New dispute needs a decision: #${p.shortId}`,
            `${CATEGORY_LABEL[input.category]}. Raised by the ${input.raisedBy}.`,
            { Order: p.orderId, Store: p.storeName, Buyer: p.buyerName, "Buyer phone": p.buyerPhone ?? "-", Details: input.description });
    }
    return disputeId;
}

/** Hands a dispute to Solely's team. */
export async function escalateDispute(
    supabase: SupabaseClient,
    p: OrderParties,
    disputeId: string,
    reason: string,
): Promise<void> {
    const { data: updated } = await supabase
        .from("disputes")
        .update({ stage: "with_admin", status: "under_review", escalated_at: new Date().toISOString(), escalation_reason: reason })
        .eq("id", disputeId)
        .neq("stage", "with_admin")
        .select("id")
        .maybeSingle();
    if (!updated) return;

    await endTimers(supabase, p.orderId, ["vendor_response", "negotiation", "fix", "return_confirm"], "escalated");
    await alertAdmins(supabase, `Dispute needs a decision: #${p.shortId}`, reason,
        { Order: p.orderId, Store: p.storeName, Buyer: p.buyerName, "Buyer phone": p.buyerPhone ?? "-", "Vendor phone": p.vendorPhone ?? "-" });

    const lines = [`Solely's team is now looking at order #${p.shortId}.`, "We'll contact you, usually within one working day. The money stays safely held until it's decided."];
    await notify(supabase, p, "buyer", { subject: `Solely is reviewing order #${p.shortId}`, lines });
    await notify(supabase, p, "vendor", { subject: `Solely is reviewing order #${p.shortId}`, lines });
}

/** Marks a dispute finished. Money must already have moved. */
export async function closeDispute(
    supabase: SupabaseClient,
    disputeId: string,
    outcome: "buyer" | "vendor" | "split" | "none",
    notes: string,
    resolvedBy: string | null = null,
    statusOverride?: "closed",
): Promise<void> {
    const status = statusOverride
        ?? (outcome === "buyer" || outcome === "split" ? "resolved_refund" : outcome === "vendor" ? "resolved_release" : "closed");
    const { data: dispute } = await supabase
        .from("disputes")
        .update({
            status,
            stage: "resolved",
            resolved_at: new Date().toISOString(),
            resolved_by: resolvedBy,
            resolution_notes: notes,
        })
        .eq("id", disputeId)
        .select("order_id")
        .maybeSingle();
    if (dispute) await endTimers(supabase, dispute.order_id, ["vendor_response", "negotiation", "fix", "return_confirm"], "done");
    await supabase.from("dispute_offers").update({ status: "expired" }).eq("dispute_id", disputeId).eq("status", "pending");
    await recordDisputeOutcome(supabase, disputeId, outcome);
}

/** Adds a line to the dispute chat, so offers and decisions show up there. */
export async function disputeNote(
    supabase: SupabaseClient,
    disputeId: string,
    senderId: string,
    role: "buyer" | "vendor" | "admin",
    message: string,
): Promise<void> {
    const { error } = await supabase.from("dispute_messages").insert({ dispute_id: disputeId, sender_id: senderId, sender_role: role, message });
    if (error) console.error("[Disputes] Couldn't add dispute note:", error);
}
