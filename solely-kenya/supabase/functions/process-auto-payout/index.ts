/**
 * Automatic Payout Processor
 * Triggers when vendor balance reaches KES 250
 * Platform pays the KES 100 IntaSend payout fee
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MINIMUM_AUTO_PAYOUT = 10000;
const INTASEND_SECRET_KEY = Deno.env.get('INTASEND_SECRET_KEY');
const INTASEND_PUBLISHABLE_KEY = Deno.env.get('INTASEND_PUBLISHABLE_KEY');

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { vendor_id, balance } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Verify balance is above minimum
        if (balance < MINIMUM_AUTO_PAYOUT) {
            throw new Error(`Balance ${balance} below minimum ${MINIMUM_AUTO_PAYOUT}`);
        }

        // Get vendor details
        const { data: vendor, error: vendorError } = await supabase
            .from('profiles')
            .select('mpesa_number, full_name, email, intasend_wallet_id')
            .eq('id', vendor_id)
            .single();

        if (vendorError || !vendor?.mpesa_number) {
            throw new Error('Vendor has no M-Pesa number');
        }

        if (!vendor.intasend_wallet_id) {
            throw new Error('Vendor has no IntaSend wallet. Cannot process WaaS payout.');
        }

        // Normalize phone number to 2547... format (required by IntaSend)
        let normalizedPhone = vendor.mpesa_number.replace(/[^0-9]/g, '');
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '254' + normalizedPhone.substring(1);
        } else if (normalizedPhone.startsWith('+254')) {
            normalizedPhone = normalizedPhone.substring(1);
        } else if (!normalizedPhone.startsWith('254')) {
            normalizedPhone = '254' + normalizedPhone;
        }


        // IntaSend Fees Logic (Matches Manual Withdraw)
        // 0 - 100: KES 10
        // 101 - 1000: KES 20
        // 1001 - 150000: KES 100

        let transactionFee = 0;
        if (balance <= 100) transactionFee = 10;
        else if (balance <= 1000) transactionFee = 20;
        else transactionFee = 100;

        // Calculate actual amount to send (Vendor pays fee)
        const netPayout = balance - transactionFee;

        // Safety check
        if (netPayout <= 0) {
            throw new Error(`Balance ${balance} insufficient to cover fee ${transactionFee}`);
        }

        console.log(`Processing auto-payout: Balance ${balance} - Fee ${transactionFee} = Sending ${netPayout} KES to ${normalizedPhone} for vendor ${vendor_id} from wallet ${vendor.intasend_wallet_id}`);

        // Call IntaSend API for M-Pesa payout
        const intasendResponse = await fetch('https://api.intasend.com/api/v1/send-money/initiate/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INTASEND_SECRET_KEY}`,
            },
            body: JSON.stringify({
                provider: 'MPESA-B2C',
                currency: 'KES',
                wallet_id: vendor.intasend_wallet_id,
                requires_approval: 'NO',
                transactions: [{
                    name: vendor.full_name || 'Vendor',
                    account: normalizedPhone,
                    amount: netPayout,
                    narrative: 'Solely payout',
                }],
            }),
        });

        // Check response content type before parsing
        const contentType = intasendResponse.headers.get('content-type');
        let intasendResult;

        if (contentType && contentType.includes('application/json')) {
            intasendResult = await intasendResponse.json();
        } else {
            const textResponse = await intasendResponse.text();
            console.error('IntaSend returned non-JSON response:', textResponse.substring(0, 500));
            throw new Error('IntaSend API error: Response was not JSON');
        }

        if (!intasendResponse.ok) {
            console.error('IntaSend error:', intasendResult);
            throw new Error(`IntaSend error: ${JSON.stringify(intasendResult)}`);
        }

        console.log('IntaSend response:', intasendResult);

        // Record payout in database
        let payoutId = null;
        try {
            const { data: payout, error: payoutError } = await supabase
                .from('payouts')
                .insert({
                    vendor_id,
                    amount_ksh: netPayout,
                    commission_amount: 0,
                    method: 'mpesa',
                    reference: intasendResult.tracking_id || intasendResult.id || `auto-${Date.now()}`,
                    status: 'paid',
                })
                .select()
                .single();

            if (payoutError) {
                console.error('Failed to record payout (non-fatal):', JSON.stringify(payoutError));
            } else {
                payoutId = payout?.id;
            }
        } catch (err) {
            console.error('Payout record error (non-fatal):', err);
            // Do not throw, continue to update balance
        }

        // Update vendor balance to 0 and increment total_paid_out
        // First get current total_paid_out
        const { data: currentBalance } = await supabase
            .from('vendor_balances')
            .select('total_paid_out')
            .eq('vendor_id', vendor_id)
            .single();

        const currentPaidOut = currentBalance?.total_paid_out || 0;

        const { error: balanceError } = await supabase
            .from('vendor_balances')
            .update({
                pending_balance: 0,
                total_paid_out: currentPaidOut + netPayout,
                last_payout_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('vendor_id', vendor_id);

        if (balanceError) {
            console.error('Failed to update balance:', balanceError);
        }

        console.log(`Auto-payout successful: ${payoutId || 'no-record'}`);

        return new Response(
            JSON.stringify({
                success: true,
                payout_id: payoutId,
                amount: netPayout,
                tracking_id: intasendResult.tracking_id || intasendResult.id
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error('Auto payout error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
