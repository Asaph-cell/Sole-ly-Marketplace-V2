/**
 * Create Vendor Wallet
 * Creates an IntaSend wallet for a vendor during registration
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

        const INTASEND_SECRET_KEY = Deno.env.get('INTASEND_SECRET_KEY');
        if (!INTASEND_SECRET_KEY) {
            throw new Error('INTASEND_SECRET_KEY is not configured');
        }

        const { vendor_id } = await req.json();

        if (!vendor_id) {
            throw new Error('vendor_id is required');
        }

        console.log(`[Create Vendor Wallet] Creating wallet for vendor: ${vendor_id}`);

        // Check if vendor already has a wallet
        const { data: existingBalance } = await supabase
            .from('vendor_balances')
            .select('intasend_wallet_id')
            .eq('vendor_id', vendor_id)
            .single();

        if (existingBalance?.intasend_wallet_id) {
            console.log(`[Create Vendor Wallet] Vendor already has wallet: ${existingBalance.intasend_wallet_id}`);
            return new Response(
                JSON.stringify({
                    success: true,
                    wallet_id: existingBalance.intasend_wallet_id,
                    message: 'Wallet already exists'
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get vendor profile for label
        const { data: profile } = await supabase
            .from('profiles')
            .select('store_name, full_name')
            .eq('id', vendor_id)
            .single();

        // Sanitize store name: only allow lowercase letters, numbers, hyphens, and underscores. No spaces, quotes, etc.
        const safeStoreName = profile?.store_name?.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
        const walletLabel = `solely-${safeStoreName || vendor_id.slice(0, 8)}`;

        // Create IntaSend wallet
        const response = await fetch('https://api.intasend.com/api/v1/wallets/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INTASEND_SECRET_KEY}`,
            },
            body: JSON.stringify({
                currency: 'KES',
                wallet_type: 'WORKING',
                label: walletLabel,
                can_disburse: true,
            }),
        });

        const responseText = await response.text();
        console.log(`[Create Vendor Wallet] IntaSend response:`, responseText);

        let walletData;
        try {
            walletData = JSON.parse(responseText);
        } catch {
            throw new Error(`IntaSend returned invalid JSON: ${responseText.substring(0, 200)}`);
        }

        if (!response.ok) {
            throw new Error(`IntaSend error: ${JSON.stringify(walletData)}`);
        }

        const walletId = walletData.wallet_id || walletData.id;
        if (!walletId) {
            throw new Error('IntaSend did not return a wallet ID');
        }

        console.log(`[Create Vendor Wallet] Created wallet: ${walletId}`);

        // Update vendor_balances with wallet ID
        const { error: balanceError } = await supabase
            .from('vendor_balances')
            .upsert({
                vendor_id: vendor_id,
                intasend_wallet_id: walletId,
                wallet_created_at: new Date().toISOString(),
            }, {
                onConflict: 'vendor_id',
            });

        if (balanceError) {
            console.error('[Create Vendor Wallet] Failed to update vendor_balances:', balanceError);
        }

        // Also update profiles table
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ intasend_wallet_id: walletId })
            .eq('id', vendor_id);

        if (profileError) {
            console.error('[Create Vendor Wallet] Failed to update profiles:', profileError);
        }

        return new Response(
            JSON.stringify({
                success: true,
                wallet_id: walletId,
                message: 'Wallet created successfully'
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error('[Create Vendor Wallet] Error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to create wallet'
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
