import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // V2: Find 'delivered' orders where the auto_release timer has fired.
    // auto_release_at is set when buyer enters the 3-digit Package PIN (+6h).
    // Pickup orders have auto_release_at = null, so they are never auto-released.
    const now = new Date().toISOString();
    const { data: ordersToRelease, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        vendor_id,
        status,
        auto_release_at,
        payout_amount,
        commission_amount,
        escrow_transactions(id, status, release_amount, commission_amount)
      `)
      .eq('status', 'delivered')
      .lte('auto_release_at', now)
      .not('auto_release_at', 'is', null);

    if (ordersError) {
      throw ordersError;
    }

    if (!ordersToRelease || ordersToRelease.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No orders ready for auto-release', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const releasedOrders = [];
    const failedOrders = [];

    for (const order of ordersToRelease) {
      try {
        const escrow = order.escrow_transactions?.[0];
        if (!escrow || escrow.status !== 'held') {
          continue;
        }

        // Update escrow status to released
        const { error: escrowError } = await supabase
          .from('escrow_transactions')
          .update({
            status: 'released',
            released_at: now,
          })
          .eq('id', escrow.id);

        if (escrowError) {
          throw escrowError;
        }

        // Update order status to completed
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'completed',
          })
          .eq('id', order.id);

        if (orderError) {
          throw orderError;
        }

        // Create payout record
        const { error: payoutError } = await supabase
          .from('payouts')
          .insert({
            order_id: order.id,
            vendor_id: order.vendor_id,
            status: 'pending',
            method: 'mpesa',
            amount_ksh: escrow.release_amount,
            commission_amount: escrow.commission_amount,
          });

        if (payoutError) {
          console.error(`Failed to create payout for order ${order.id}:`, payoutError);
        }

        // Record commission in ledger
        const { error: commissionError } = await supabase
          .from('commission_ledger')
          .insert({
            order_id: order.id,
            vendor_id: order.vendor_id,
            commission_rate: 6,
            commission_amount: escrow.commission_amount,
            notes: 'Auto-released 6 hours after buyer entered Package PIN (no vendor OTP)',
          });

        if (commissionError) {
          console.error(`Failed to record commission for order ${order.id}:`, commissionError);
        }
        // 5. Transfer funds to vendor's IntaSend wallet (AWAITED to prevent balance desync)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        
        console.log(`[Auto-Release Escrow] Triggering transfer-to-vendor-wallet for order ${order.id}...`);
        try {
            const transferResponse = await fetch(`${supabaseUrl}/functions/v1/transfer-to-vendor-wallet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({ order_id: order.id }),
            });
            
            const transferResult = await transferResponse.json().catch(() => null);
            
            if (!transferResponse.ok || transferResult?.error) {
                console.error(`[Auto-Release Escrow] IntaSend wallet transfer FAILED for order ${order.id}:`, transferResult);
                // Roll back the DB balance since the real money didn't move
                const releaseAmount = escrow.release_amount || 0;
                const { data: currentBal } = await supabase
                    .from('vendor_balances')
                    .select('pending_balance, total_earned')
                    .eq('vendor_id', order.vendor_id)
                    .single();
                
                if (currentBal) {
                    const correctedBalance = Math.max(0, (currentBal.pending_balance || 0) - releaseAmount);
                    const correctedEarned = Math.max(0, (currentBal.total_earned || 0) - releaseAmount);
                    await supabase
                        .from('vendor_balances')
                        .update({
                            pending_balance: correctedBalance,
                            total_earned: correctedEarned,
                            updated_at: now,
                        })
                        .eq('vendor_id', order.vendor_id);
                    console.warn(`[Auto-Release Escrow] Rolled back DB balance by ${releaseAmount} for vendor ${order.vendor_id}`);
                }
            } else {
                console.log(`[Auto-Release Escrow] Transfer successful for order ${order.id}`);
            }
        } catch (err) {
            console.error('[Auto-Release Escrow] Failed to trigger transfer:', err);
        }

        releasedOrders.push(order.id);
        console.log(`Auto-released escrow for order ${order.id}`);
      } catch (error) {
        console.error(`Failed to auto-release order ${order.id}:`, error);
        failedOrders.push({ orderId: order.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        released: releasedOrders.length,
        failed: failedOrders.length,
        releasedOrders,
        failedOrders,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-release-escrow:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to process auto-release',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

