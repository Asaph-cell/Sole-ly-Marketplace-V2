/**
 * Admin alerts
 *
 * Emails every admin about something that needs a human: a payout the
 * system refused, a dispute escalation, a "buyer unavailable" claim, etc.
 * Never throws - an alert failing must not break the money path that
 * raised it, so failures are only logged.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, baseEmailLayout, escapeHtml } from "./email-service.ts";

export async function getAdminEmails(supabase: SupabaseClient): Promise<string[]> {
    const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
    if (error || !roles) {
        console.error("[Admin Alert] Failed to load admin roles:", error);
        return [];
    }

    const emails: string[] = [];
    for (const { user_id } of roles) {
        const { data } = await supabase.auth.admin.getUserById(user_id);
        if (data?.user?.email) emails.push(data.user.email);
    }
    return emails;
}

/**
 * @param details plain-text label/value pairs, escaped before rendering
 */
export async function alertAdmins(
    supabase: SupabaseClient,
    subject: string,
    message: string,
    details: Record<string, unknown> = {},
): Promise<void> {
    try {
        const to = await getAdminEmails(supabase);
        if (to.length === 0) {
            console.error(`[Admin Alert] No admin emails found, alert dropped: ${subject}`);
            return;
        }

        const rows = Object.entries(details)
            .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
            .join("");

        const result = await sendEmail({
            to,
            subject: `[Solely Admin] ${subject}`,
            html: baseEmailLayout(subject, `<p>${escapeHtml(message)}</p>${rows}`),
        });
        if (!result.success) console.error(`[Admin Alert] Send failed for "${subject}":`, result.error);
    } catch (err) {
        console.error(`[Admin Alert] Unexpected failure for "${subject}":`, err);
    }
}
