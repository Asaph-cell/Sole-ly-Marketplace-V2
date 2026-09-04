/**
 * Check and Process Automatic Payouts
 * Called by cron job every minute
 * Finds vendors with balance >= KES 250 and processes payouts directly
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPlatformSetting, getPayoutFeeSchedule, resolvePayoutFee } from "../_shared/platform-settings.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // Internal-only: this function disburses real M-Pesa money and must only
    // ever be triggered by the pg_cron job, which authenticates with the
    // service-role key. Reject anything else.
    const authHeader = req.headers.get('Authorization');
    const expectedAuth = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
    if (!authHeader || authHeader !== expectedAuth) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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

        console.log(`[Auto-Payout Checker] Starting payout check...`);

        const minimumAutoPayout = await getPlatformSetting(supabase, 'minimum_auto_payout_ksh', 10000);
        const payoutFeeSchedule = await getPayoutFeeSchedule(supabase);

        // Find all vendors with balance >= minimum payout threshold
        const { data: eligibleVendors, error: vendorsError } = await supabase
            .from('vendor_balances')
            .select('vendor_id, pending_balance, total_paid_out')
            .gte('pending_balance', minimumAutoPayout);

        if (vendorsError) {
            console.error('[Auto-Payout Checker] Error fetching vendor balances:', vendorsError);
            throw vendorsError;
        }

        if (!eligibleVendors || eligibleVendors.length === 0) {
            console.log('[Auto-Payout Checker] No vendors eligible for automatic payout');
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'No vendors eligible for payout',
                    count: 0
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[Auto-Payout Checker] Found ${eligibleVendors.length} vendor(s) eligible for payout`);

        // Process each vendor's payout
        const results = [];
        for (const vendorBalanceRec of eligibleVendors) {
            const vendorId = vendorBalanceRec.vendor_id;
            const balance = vendorBalanceRec.pending_balance;

            try {
                console.log(`[Auto-Payout Checker] Processing payout for vendor ${vendorId}: KES ${balance}`);

                // 1. Get vendor profile for M-Pesa number
                const { data: vendorProfile, error: profileError } = await supabase
                    .from('profiles')
                    .select('mpesa_number, full_name, email')
                    .eq('id', vendorId)
                    .single();

                if (profileError || !vendorProfile?.mpesa_number) {
                    throw new Error('Vendor has no M-Pesa number');
                }

                // 2. Normalize phone number
                let normalizedPhone = vendorProfile.mpesa_number.replace(/[^0-9]/g, '');
                if (normalizedPhone.startsWith('0')) {
                    normalizedPhone = '254' + normalizedPhone.substring(1);
                } else if (normalizedPhone.startsWith('+254')) {
                    normalizedPhone = normalizedPhone.substring(1);
                } else if (!normalizedPhone.startsWith('254')) {
                    normalizedPhone = '254' + normalizedPhone;
                }

                const netPayout = balance - resolvePayoutFee(payoutFeeSchedule, balance);

                // Atomically claim this balance before paying out, so two
                // overlapping runs (or a retried/duplicate invocation) can
                // never disburse the same balance twice. Only succeeds if the
                // balance is still exactly what we just read.
                const { data: claimedBalance, error: claimErr } = await supabase
                    .from('vendor_balances')
                    .update({ pending_balance: 0, updated_at: new Date().toISOString() })
                    .eq('vendor_id', vendorId)
                    .eq('pending_balance', balance)
                    .select('vendor_id')
                    .maybeSingle();

                if (claimErr) {
                    throw new Error(`Failed to claim balance for vendor ${vendorId}: ${claimErr.message}`);
                }
                if (!claimedBalance) {
                    console.log(`[Auto-Payout Checker] Balance for ${vendorId} changed or already claimed - skipping.`);
                    results.push({ vendor_id: vendorId, success: false, skipped: true, reason: 'already_claimed' });
                    continue;
                }

                // 3. Call IntaSend API
                let intasendResult;
                try {
                    console.log(`[Auto-Payout Checker] Initiating IntaSend transfer to ${normalizedPhone}`);
                    const intasendResponse = await fetch('https://api.intasend.com/api/v1/send-money/initiate/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${INTASEND_SECRET_KEY}`,
                        },
                        body: JSON.stringify({
                            provider: 'MPESA-B2C',
                            currency: 'KES',
                            requires_approval: 'NO',
                            transactions: [{
                                name: vendorProfile.full_name || 'Vendor',
                                account: normalizedPhone,
                                amount: netPayout,
                                narrative: 'Solely Kenya payout',
                            }],
                        }),
                    });

                    const contentType = intasendResponse.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        intasendResult = await intasendResponse.json();
                    } else {
                        const text = await intasendResponse.text();
                        throw new Error(`IntaSend returned non-JSON: ${text.substring(0, 100)}`);
                    }

                    if (!intasendResponse.ok) {
                        throw new Error(`IntaSend error: ${JSON.stringify(intasendResult)}`);
                    }
                } catch (transferErr) {
                    // The disbursement never succeeded, so restore the balance
                    // we claimed above - a later run should retry this vendor.
                    await supabase.from('vendor_balances').update({ pending_balance: balance, updated_at: new Date().toISOString() }).eq('vendor_id', vendorId);
                    throw transferErr;
                }

                // 4. Record Payout
                let payoutId = null;
                const { data: payout, error: payoutError } = await supabase
                    .from('payouts')
                    .insert({
                        vendor_id: vendorId,
                        amount_ksh: netPayout,
                        commission_amount: 0,
                        method: 'mpesa',
                        reference: intasendResult.tracking_id || intasendResult.id || `auto-${Date.now()}`,
                        status: 'paid',
                    })
                    .select()
                    .single();

                if (payoutError) {
                    console.error('Failed to record payout to DB (non-fatal):', payoutError);
                } else {
                    payoutId = payout?.id;
                }

                // 5. Update running totals (pending_balance was already zeroed
                // by the atomic claim above, before the money moved).
                const { error: updateError } = await supabase
                    .from('vendor_balances')
                    .update({
                        total_paid_out: (vendorBalanceRec.total_paid_out || 0) + netPayout,
                        last_payout_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('vendor_id', vendorId);

                if (updateError) {
                    console.error('Failed to update balance:', updateError);
                    throw updateError;
                }

                console.log(`[Auto-Payout Checker] Successfully processed payout for ${vendorId}`);
                results.push({
                    vendor_id: vendorId,
                    success: true,
                    amount: netPayout
                });

            } catch (error) {
                console.error(`[Auto-Payout Checker] Exception processing vendor ${vendorId}:`, error);
                results.push({
                    vendor_id: vendorId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        console.log(`[Auto-Payout Checker] Completed: ${successCount} successful, ${failCount} failed`);

        return new Response(
            JSON.stringify({
                success: true,
                results: results
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error('[Auto-Payout Checker] Fatal error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error'
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
