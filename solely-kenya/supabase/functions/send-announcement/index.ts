import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY not configured");
        }

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
        const { subject, htmlContent, targetAudience }: AnnouncementRequest = await req.json();

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

        // Build email HTML with styling
        const styledHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #c8b34d 0%, #a89640 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          a { color: #c8b34d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Solely</h1>
          </div>
          <div class="content">
            ${htmlContent}
          </div>
          <div class="footer">
            <p>This email was sent by Solely</p>
            <p><a href="https://solelymarketplace.com">solelymarketplace.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

        // Send emails one at a time with delay to respect Resend's 2 req/s rate limit
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            try {
                const response = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${RESEND_API_KEY}`,
                    },
                    body: JSON.stringify({
                        from: "Solely <notifications@solelymarketplace.com>",
                        to: [email],
                        subject: subject,
                        html: styledHtml,
                    }),
                });

                if (response.ok) {
                    sent++;
                    console.log(`Sent to ${email} (${i + 1}/${emails.length})`);
                } else {
                    const error = await response.json();
                    console.error(`Failed to send to ${email}:`, error);
                    failed++;
                }
            } catch (error) {
                console.error(`Error sending to ${email}:`, error);
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
