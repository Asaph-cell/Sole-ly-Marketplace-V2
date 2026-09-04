import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnnouncementRequest {
    subject: string;
    htmlContent: string;
    targetAudience: "all" | "vendors" | "customers" | "custom";
    customEmails?: string[];
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
        const { subject, htmlContent, targetAudience, customEmails }: AnnouncementRequest = await req.json();

        if (!subject || !htmlContent || !targetAudience) {
            throw new Error("Missing required fields: subject, htmlContent, targetAudience");
        }

        // Fetch email addresses based on target audience
        let emails: string[] = [];

        if (targetAudience === "custom" && customEmails && customEmails.length > 0) {
            emails = customEmails;
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
                    .select("email")
                    .in("id", vendorIds)
                    .not("email", "is", null);

                emails = (profiles || []).map(p => p.email).filter(Boolean);
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
                .select("email")
                .not("email", "is", null);

            // Filter out vendors
            emails = (profiles || [])
                .filter(p => !vendorIds.includes(p.id))
                .map(p => p.email)
                .filter(Boolean);
        } else if (targetAudience === "all") {
            // All users
            const { data: profiles } = await supabase
                .from("profiles")
                .select("email")
                .not("email", "is", null);

            emails = (profiles || []).map(p => p.email).filter(Boolean);
        } else {
            throw new Error(`Invalid targetAudience: ${targetAudience}`);
        }

        // Remove duplicates
        emails = [...new Set(emails)];

        if (emails.length === 0) {
            return new Response(
                JSON.stringify({ success: true, sent: 0, message: "No recipients found" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Same branded shell every transactional email uses (order confirmations,
        // dispute updates, etc.) - the admin only ever supplies a subject and a
        // message body, never the surrounding template.
        const styledHtml = emailTemplates.announcement({ subject, bodyHtml: htmlContent });

        // Send emails one at a time with delay to respect Resend's 2 req/s rate limit
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            const result = await sendEmail({ to: email, subject, html: styledHtml });

            if (result.success) {
                sent++;
                console.log(`Sent to ${email} (${i + 1}/${emails.length})`);
            } else {
                console.error(`Failed to send to ${email}:`, result.error);
                failed++;
            }

            // Wait 600ms between sends to stay under Resend's 2 req/s limit
            if (i < emails.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 600));
            }
        }

        console.log(`Announcement sent: ${sent} successful, ${failed} failed`);

        return new Response(
            JSON.stringify({
                success: true,
                sent,
                failed,
                total: emails.length,
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
