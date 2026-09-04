/**
 * Process Payouts - IntaSend M-Pesa API
 * 
 * Sends vendor payouts via IntaSend Transfers to M-Pesa
 * This is a fallback/batch processor for pending payouts
 * Primary automatic payouts are handled by process-auto-payout
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getPayoutFeeSchedule, resolvePayoutFee } from "../_shared/platform-settings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal-only: this function disburses real M-Pesa money and must only
  // ever be triggered by its scheduled cron job, which authenticates with the
  // service-role key. Reject anything else.
  const authHeader = req.headers.get('Authorization');
  const expectedAuth = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  if (!authHeader || authHeader !== expectedAuth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const intasendSecretKey = Deno.env.get('INTASEND_SECRET_KEY');
    if (!intasendSecretKey) {
      throw new Error('INTASEND_SECRET_KEY not configured');
    }

    // Get pending payouts
    const { data: pendingPayouts, error: payoutsError } = await supabase
      .from('payouts')
      .select(`
        id,
        order_id,
        vendor_id,
        amount_ksh,
        commission_amount,
        method,
        profiles!payouts_vendor_id_fkey(mpesa_number, full_name, email, intasend_wallet_id)
      `)
      .eq('status', 'pending')
      .limit(50); // Process in batches


    if (payoutsError) {
      throw payoutsError;
    }

    if (!pendingPayouts || pendingPayouts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending payouts', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingPayouts.length} pending payouts via IntaSend`);

    const processedPayouts = [];
    const failedPayouts = [];
    const payoutFeeSchedule = await getPayoutFeeSchedule(supabase);

    for (const payout of pendingPayouts) {
      try {
        // Atomically claim this payout (only if it's still 'pending') before
        // doing anything else, so two overlapping runs of this function can
        // never disburse the same payout twice.
        const { data: claimed, error: claimError } = await supabase
          .from('payouts')
          .update({
            status: 'processing',
            processing_at: new Date().toISOString(),
          })
          .eq('id', payout.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();

        if (claimError) {
          throw new Error(`Failed to claim payout ${payout.id}: ${claimError.message}`);
        }
        if (!claimed) {
          console.log(`Payout ${payout.id} already claimed by another run - skipping.`);
          continue;
        }

        const vendorProfile = payout.profiles;
        if (!vendorProfile?.mpesa_number) {
          throw new Error('Vendor has no M-Pesa number configured');
        }

        if (!vendorProfile?.intasend_wallet_id) {
          throw new Error('Vendor has no IntaSend wallet configured');
        }

        // Format phone number for IntaSend (should be like 254712345678)
        let phoneNumber = vendorProfile.mpesa_number.replace(/\D/g, '');
        if (phoneNumber.startsWith('0')) {
          phoneNumber = '254' + phoneNumber.slice(1);
        } else if (!phoneNumber.startsWith('254')) {
          phoneNumber = '254' + phoneNumber;
        }

        // Call IntaSend API for M-Pesa payout
        // Using send-money/initiate endpoint for wallet withdrawals instead of send-money/mpesa
        const intasendResponse = await fetch('https://api.intasend.com/api/v1/send-money/initiate/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${intasendSecretKey}`,
          },
          body: JSON.stringify({
            provider: 'MPESA-B2C',
            currency: 'KES',
            wallet_id: vendorProfile.intasend_wallet_id,
            requires_approval: 'NO',
            transactions: [{
              name: vendorProfile.full_name || 'Vendor',
              account: phoneNumber,
              amount: payout.amount_ksh,
              narrative: `Solely Kenya payout for order ${payout.order_id?.substring(0, 8) || 'batch'}`,
            }],
          }),
        });

        const intasendResult = await intasendResponse.json();
        console.log('IntaSend response:', intasendResult);

        if (!intasendResponse.ok) {
          throw new Error(`IntaSend error: ${JSON.stringify(intasendResult)}`);
        }

        // Update payout with success status
        await supabase
          .from('payouts')
          .update({
            status: 'processing', // IntaSend processes async, will be updated by webhook
            paid_at: new Date().toISOString(),
            reference: intasendResult.tracking_id || intasendResult.id,
            transfer_fee_ksh: resolvePayoutFee(payoutFeeSchedule, payout.amount_ksh),
            metadata: {
              intasend_tracking_id: intasendResult.tracking_id,
              intasend_status: intasendResult.status,
            },
          })
          .eq('id', payout.id);

        processedPayouts.push(payout.id);
        console.log(`✅ Initiated payout ${payout.id} - KES ${payout.amount_ksh} to ${phoneNumber}`);

      } catch (error) {
        console.error(`❌ Failed to process payout ${payout.id}:`, error);

        await supabase
          .from('payouts')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            failure_reason: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', payout.id);

        failedPayouts.push({
          payoutId: payout.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Initiated ${processedPayouts.length} payouts, ${failedPayouts.length} failed`,
        processed: processedPayouts.length,
        failed: failedPayouts.length,
        processedPayouts,
        failedPayouts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-payouts:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to process payouts',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
