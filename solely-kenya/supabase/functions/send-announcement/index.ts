import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
    email: string;
    name?: string | null;
    store?: string | null;
}

interface AnnouncementRequest {
    subject: string;
    htmlContent: string;
    targetAudience: "all" | "vendors" | "customers" | "custom";
    customEmails?: string[];
    customRecipients?: Recipient[];
}

// Swaps {{name}} / {{store}} tokens in admin-written subject/body for each
// recipient's own name/store, so one composed message reads as personal mail
// instead of an identical blast.
function personalize(text: string, recipient: Recipient): string {
    return text
        .replace(/\{\{\s*name\s*\}\}/gi, recipient.name?.trim() || "there")
        .replace(/\{\{\s*store\s*\}\}/gi, recipient.store?.trim() || "your store");
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Supabase credentials not configured");
        }

        // Verify admin authorization
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            throw new Error("No authorization header");
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Verify the user is an admin
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            throw new Error("Unauthorized");
        }

        const { data: adminRole } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .single();

        if (!adminRole) {
            throw new Error("Admin access required");
        }

        // Parse request
        const { subject, htmlContent, targetAudience, customEmails, customRecipients }: AnnouncementRequest = await req.json();

        if (!subject || !htmlContent || !targetAudience) {
            throw new Error("Missing required fields: subject, htmlContent, targetAudience");
        }

        // Resolve recipients (with name/store, for {{name}}/{{store}} personalization) based on target audience
        let recipients: Recipient[] = [];

        if (targetAudience === "custom" && customRecipients && customRecipients.length > 0) {
            recipients = customRecipients.filter(r => r.email);
        } else if (targetAudience === "custom" && customEmails && customEmails.length > 0) {
            recipients = customEmails.map(email => ({ email }));
        } else if (targetAudience === "vendors") {
            // Get all vendor emails
            const { data: vendorRoles } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("role", "vendor");

            if (vendorRoles && vendorRoles.length > 0) {
                const vendorIds = vendorRoles.map(v => v.user_id);
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("email, full_name, store_name")
                    .in("id", vendorIds)
                    .not("email", "is", null);

                recipients = (profiles || [])
                    .filter(p => p.email)
                    .map(p => ({ email: p.email as string, name: p.full_name, store: p.store_name }));
            }
        } else if (targetAudience === "customers") {
            // Get all non-vendor users
            const { data: vendorRoles } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("role", "vendor");

            const vendorIds = (vendorRoles || []).map(v => v.user_id);

            const { data: profiles } = await supabase
                .from("profiles")
                .select("email, full_name, store_name")
                .not("email", "is", null);

            // Filter out vendors
            recipients = (profiles || [])
                .filter(p => !vendorIds.includes(p.id) && p.email)
                .map(p => ({ email: p.email as string, name: p.full_name, store: p.store_name }));
        } else if (targetAudience === "all") {
            // All users
            const { data: profiles } = await supabase
                .from("profiles")
                .select("email, full_name, store_name")
                .not("email", "is", null);

            recipients = (profiles || [])
                .filter(p => p.email)
                .map(p => ({ email: p.email as string, name: p.full_name, store: p.store_name }));
        } else {
            throw new Error(`Invalid targetAudience: ${targetAudience}`);
        }

        // Remove duplicates by email, keeping the first name/store seen for that address
        const byEmail = new Map<string, Recipient>();
        for (const r of recipients) {
            if (!byEmail.has(r.email)) byEmail.set(r.email, r);
        }
        recipients = [...byEmail.values()];

        if (recipients.length === 0) {
            return new Response(
                JSON.stringify({ success: true, sent: 0, message: "No recipients found" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Send emails one at a time with delay to respect Resend's 2 req/s rate limit.
        // Subject/body are personalized per recipient before being wrapped in the same
        // branded shell every transactional email uses.
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const personalizedSubject = personalize(subject, recipient);
            const personalizedBody = personalize(htmlContent, recipient);
            const styledHtml = emailTemplates.announcement({ subject: personalizedSubject, bodyHtml: personalizedBody });
            const result = await sendEmail({ to: recipient.email, subject: personalizedSubject, html: styledHtml });

            if (result.success) {
                sent++;
                console.log(`Sent to ${recipient.email} (${i + 1}/${recipients.length})`);
            } else {
                console.error(`Failed to send to ${recipient.email}:`, result.error);
                failed++;
            }

            // Wait 600ms between sends to stay under Resend's 2 req/s limit
            if (i < recipients.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 600));
            }
        }

        console.log(`Announcement sent: ${sent} successful, ${failed} failed`);

        return new Response(
            JSON.stringify({
                success: true,
                sent,
                failed,
                total: recipients.length,
                message: `Successfully sent to ${sent} recipients${failed > 0 ? `, ${failed} failed` : ""}`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error in send-announcement:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
