/**
 * Vendor strikes and buyer abuse tracking.
 *
 * Vendors: a strike for accepting an order and never delivering it (or a
 * false "buyer unavailable" claim). The 1st and 2nd get a warning email;
 * the 3rd within a rolling 90 days suspends the shop until an admin
 * restores it.
 *
 * Buyers: disputes they *lost* (not merely filed) in the same window. 3
 * flags them to admin; 5 suspends the account.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPlatformSetting } from "./platform-settings.ts";
import { alertAdmins } from "./admin-alerts.ts";
import { sendEmail, baseEmailLayout, escapeHtml } from "./email-service.ts";
import { SITE_URL } from "./notify.ts";

export type StrikeReason = "not_shipped" | "not_delivered" | "false_buyer_unavailable" | "admin";

const REASON_TEXT: Record<StrikeReason, string> = {
    not_shipped: "you accepted an order but didn't ship it or send an update in time",
    not_delivered: "an order you shipped didn't arrive and you didn't send an update in time",
    false_buyer_unavailable: "you reported a buyer as unavailable, but Solely confirmed they were there",
    admin: "Solely's team recorded a strike on your shop",
};

async function windowStart(supabase: SupabaseClient): Promise<string> {
    const days = await getPlatformSetting(supabase, "strike_window_days", 90);
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function emailUser(supabase: SupabaseClient, userId: string, subject: string, lines: string[], ctaPath = "/vendor/orders") {
    const { data } = await supabase.auth.admin.getUserById(userId);
    const to = data?.user?.email;
    if (!to) return;
    const body = lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")
        + `<p style="text-align:center;margin-top:28px;"><a href="${SITE_URL}${ctaPath}" class="cta-button">Open Solely</a></p>`;
    const r = await sendEmail({ to, subject, html: baseEmailLayout(subject, body) });
    if (!r.success) console.error("[Strikes] Email failed:", r.error);
}

export async function activeStrikeCount(supabase: SupabaseClient, vendorId: string): Promise<number> {
    const since = await windowStart(supabase);
    const { count } = await supabase
        .from("vendor_strikes")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId)
        .is("voided_at", null)
        .gte("created_at", since);
    return count ?? 0;
}

export async function addStrike(
    supabase: SupabaseClient,
    vendorId: string,
    orderId: string | null,
    reason: StrikeReason,
    notes?: string,
): Promise<number> {
    const { error } = await supabase.from("vendor_strikes").insert({ vendor_id: vendorId, order_id: orderId, reason, notes: notes ?? null });
    if (error) {
        console.error("[Strikes] Couldn't record strike:", error);
        return 0;
    }

    const count = await activeStrikeCount(supabase, vendorId);
    const limit = await getPlatformSetting(supabase, "strikes_to_suspend", 3);
    const order = orderId ? ` on order #${orderId.slice(0, 8)}` : "";

    if (count >= limit) {
        await suspendVendor(supabase, vendorId, `${count} strikes within the strike window`);
    } else if (count === limit - 1) {
        await emailUser(supabase, vendorId, "Final warning: one more strike suspends your shop", [
            `Your shop received a strike${order} because ${REASON_TEXT[reason]}.`,
            `This is strike ${count} of ${limit}. One more within 90 days and your shop will be suspended: your listings will be hidden and you won't be able to sell.`,
            "Strikes expire 90 days after they're given.",
        ]);
    } else {
        await emailUser(supabase, vendorId, "Warning: your shop received a strike", [
            `Your shop received a strike${order} because ${REASON_TEXT[reason]}.`,
            `This is strike ${count} of ${limit}. ${limit} strikes within 90 days suspends your shop.`,
            "Ship accepted orders on time, and send an update whenever there's a delay.",
        ]);
    }
    return count;
}

export async function suspendVendor(supabase: SupabaseClient, vendorId: string, reason: string): Promise<void> {
    const { data: updated } = await supabase
        .from("profiles")
        .update({ suspended_at: new Date().toISOString(), suspension_reason: reason })
        .eq("id", vendorId)
        .is("suspended_at", null)
        .select("store_name")
        .maybeSingle();
    if (!updated) return; // already suspended

    await emailUser(supabase, vendorId, "Your Solely shop has been suspended", [
        `Your shop has been suspended (${reason}).`,
        "Your listings are hidden and you can't take new orders. Please finish any orders you already have: they continue as normal and you'll still be paid for them.",
        "Contact Solely support to discuss restoring your shop.",
    ]);
    await alertAdmins(supabase, `Vendor suspended: ${updated.store_name ?? vendorId}`,
        "A vendor was suspended automatically. Their open orders continue. Restore them from Admin > Vendors.",
        { "Vendor ID": vendorId, Reason: reason });
}

/**
 * Records who a resolved dispute favoured and, if it went against the
 * buyer, applies the abusive-buyer thresholds.
 */
export async function recordDisputeOutcome(
    supabase: SupabaseClient,
    disputeId: string,
    outcome: "buyer" | "vendor" | "split" | "none",
): Promise<void> {
    const { data: dispute } = await supabase
        .from("disputes")
        .update({ outcome })
        .eq("id", disputeId)
        .select("customer_id")
        .maybeSingle();
    if (outcome !== "vendor" || !dispute?.customer_id) return;

    const buyerId = dispute.customer_id;
    const since = await windowStart(supabase);
    const { count } = await supabase
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", buyerId)
        .eq("outcome", "vendor")
        .gte("opened_at", since);
    const lost = count ?? 0;

    const [flagAt, suspendAt] = await Promise.all([
        getPlatformSetting(supabase, "buyer_lost_disputes_flag", 3),
        getPlatformSetting(supabase, "buyer_lost_disputes_suspend", 5),
    ]);

    if (lost >= suspendAt) {
        const { error } = await supabase.from("account_bans").upsert({
            user_id: buyerId,
            reason: `${lost} disputes lost within the strike window`,
            ban_type: "suspended",
            banned_at: new Date().toISOString(),
            lifted_at: null,
        }, { onConflict: "user_id" });
        if (error) console.error("[Strikes] Couldn't suspend buyer:", error);
        await alertAdmins(supabase, "Buyer suspended for repeated false disputes",
            "A buyer lost too many disputes and can no longer place orders. Lift it from Admin > Disputes if this was a mistake.",
            { "Buyer ID": buyerId, "Disputes lost": lost });
    } else if (lost === flagAt) {
        await alertAdmins(supabase, "Buyer flagged for repeated disputes",
            `This buyer has lost ${lost} disputes recently. At ${suspendAt} they're suspended automatically.`,
            { "Buyer ID": buyerId, "Disputes lost": lost });
    }
}
