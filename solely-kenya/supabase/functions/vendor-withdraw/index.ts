/**
 * Vendor Withdraw
 * Instant withdrawal from vendor's IntaSend wallet to their M-Pesa
 * Strict Withdraw All - No Partial Withdrawals
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

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization header');
        }

        const supabaseAuth = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
        if (authError || !user || user.id !== vendor_id) {
            throw new Error('Unauthorized');
        }

        console.log(`[Vendor Withdraw] Processing withdrawal for vendor: ${vendor_id}`);

        // Get vendor profile for M-Pesa number
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('mpesa_number, full_name, intasend_wallet_id')
            .eq('id', vendor_id)
            .single();

        if (profileError || !profile) {
            throw new Error('Vendor profile not found');
        }

        if (!profile.mpesa_number) {
            throw new Error('No M-Pesa number configured. Please update your profile with your M-Pesa number.');
        }

        if (!profile.intasend_wallet_id) {
            throw new Error('No IntaSend wallet found. Please contact support.');
        }

        // Get vendor balance
        const { data: balance, error: balanceError } = await supabase
            .from('vendor_balances')
            .select('pending_balance, intasend_wallet_id')
            .eq('vendor_id', vendor_id)
            .single();

        if (balanceError || !balance) {
            throw new Error('Could not fetch balance');
        }

        // STRICT WITHDRAW ALL MODE
        // Users must withdraw their ENTIRE balance.
        const totalBalance = balance.pending_balance;

        if (totalBalance <= 0) {
            throw new Error('No balance available for withdrawal');
        }

        // IntaSend Fees Logic (Disbursement to M-Pesa)
        // 0 - 100: KES 0
        // 101 - 1000: KES 20
        // 1001 - 150000: KES 100 (Maximum)

        let transactionFee = 0;
        if (totalBalance <= 100) transactionFee = 0;
        else if (totalBalance <= 1000) transactionFee = 20;
        else transactionFee = 100;

        // Calculate actual amount to send
        const amountToSend = totalBalance - transactionFee;

        // Safety Check
        if (amountToSend <= 0) {
            throw new Error(`Insufficient balance to cover the KES ${transactionFee} transaction fee.`);
        }

        // Normalize phone number for IntaSend
        let normalizedPhone = profile.mpesa_number.replace(/[^0-9]/g, '');
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '254' + normalizedPhone.substring(1);
        } else if (normalizedPhone.startsWith('+254')) {
            normalizedPhone = normalizedPhone.substring(1);
        } else if (!normalizedPhone.startsWith('254')) {
            normalizedPhone = '254' + normalizedPhone;
        }

        console.log(`[Vendor Withdraw] Balance: KES ${totalBalance}, Fee: KES ${transactionFee}, Sending: KES ${amountToSend}`);

        // Send money from vendor's wallet to their M-Pesa
        const response = await fetch('https://api.intasend.com/api/v1/send-money/initiate/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INTASEND_SECRET_KEY}`,
            },
            body: JSON.stringify({
                provider: 'MPESA-B2C',
                currency: 'KES',
                wallet_id: profile.intasend_wallet_id,
                requires_approval: 'NO',
                transactions: [{
                    name: profile.full_name || 'Vendor',
                    account: normalizedPhone,
                    amount: amountToSend.toFixed(2),
                    narrative: 'Solely Kenya withdrawal',
                }],
            }),
        });

        const responseText = await response.text();
        console.log(`[Vendor Withdraw] IntaSend response:`, responseText);

        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            throw new Error(`IntaSend returned invalid JSON: ${responseText.substring(0, 200)}`);
        }

        if (!response.ok) {
            console.error(`[Vendor Withdraw] IntaSend API failed. Status: ${response.status}`);
            const errorDetail = result.errors?.[0]?.detail || result.message || result.error || '';
            throw new Error(`Withdrawal failed: ${errorDetail || responseText.substring(0, 200)}`);
        } else {
            console.log(`[Vendor Withdraw] Withdrawal initiated successfully. Tracking ID: ${result.tracking_id || result.id}`);
        }

        // Get current balance values for proper update
        const { data: currentBalance } = await supabase
            .from('vendor_balances')
            .select('pending_balance, total_paid_out')
            .eq('vendor_id', vendor_id)
            .single();

        const currentPaidOut = currentBalance?.total_paid_out || 0;
        const currentPending = currentBalance?.pending_balance || 0;

        // Determine new Balance.
        // We deducted (amountToSend + transactionFee) which should equal totalBalance.
        // So new balance should be 0. 
        // But to be safe against race conditions, we deduct from 'currentPending'.

        const totalDeducted = amountToSend + transactionFee;
        const newBalance = Math.max(0, currentPending - totalDeducted);
        const newTotalPaidOut = currentPaidOut + amountToSend;

        // Update vendor balance
        const { error: updateError } = await supabase
            .from('vendor_balances')
            .update({
                pending_balance: newBalance,
                total_paid_out: newTotalPaidOut,
                last_payout_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('vendor_id', vendor_id);

        if (updateError) {
            console.error('[Vendor Withdraw] Balance update failed:', updateError);
        }

        // Record the payout
        await supabase.from('payouts').insert({
            vendor_id: vendor_id,
            amount_ksh: amountToSend,
            commission_amount: 0,
            method: 'mpesa',
            reference: result.tracking_id || result.id || `withdraw-${Date.now()}`,
            status: 'processing',
            trigger_type: 'manual',
        });

        return new Response(
            JSON.stringify({
                success: true,
                amount: totalDeducted, // Total removed from wallet
                net_amount: amountToSend, // Actual cash received
                fee: transactionFee,
                new_balance: newBalance,
                message: `KES ${amountToSend.toLocaleString()} sent to your M-Pesa. Fee: KES ${transactionFee}`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error('[Vendor Withdraw] Error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Withdrawal failed'
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
