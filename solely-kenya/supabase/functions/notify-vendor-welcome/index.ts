/**
 * Notify Vendor Welcome
 * Sends a welcome email to a newly registered vendor
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { vendorId } = await req.json();

        if (!vendorId) {
            throw new Error('vendorId is required');
        }

        console.log(`[Notify Vendor Welcome] Processing welcome email for vendor: ${vendorId}`);

        // Get vendor profile details
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email, full_name, store_name')
            .eq('id', vendorId)
            .single();

        if (profileError || !profile) {
            throw new Error(`Vendor profile not found: ${vendorId}`);
        }

        if (!profile.email) {
            throw new Error(`Vendor has no email address`);
        }

        const businessName = profile.store_name || profile.full_name || 'Vendor';

        // Send email
        const emailSent = await sendEmail({
            to: profile.email,
            subject: 'Welcome to Sole-ly! Start selling today',
            html: emailTemplates.vendorWelcome({
                businessName: businessName,
                dashboardUrl: 'https://solelymarketplace.com/vendor',
            }),
        });

        console.log(`[Notify Vendor Welcome] Email sent status: ${emailSent}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Welcome email sent successfully',
                emailSent,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error('[Notify Vendor Welcome] Error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to send welcome email'
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
