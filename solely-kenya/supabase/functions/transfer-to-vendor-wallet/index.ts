/**
 * Transfer to Vendor Wallet
 * Transfers vendor's share (minus commission) from settlement to vendor wallet
 * Called after order completion
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCommissionRatePercent } from "../_shared/platform-settings.ts";
import { alertAdmins } from "../_shared/admin-alerts.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SETTLEMENT_WALLET_ID = Deno.env.get('INTASEND_SETTLEMENT_WALLET_ID') || 'KZRJ8VY';

// Thrown when the transfer request reached IntaSend but we can't tell whether
// it went through (network drop mid-request, or a 2xx with an unreadable
// body). The money may already have moved, so the claim must NOT be released.
class AmbiguousTransferError extends Error {}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // Internal-only: this function moves real money and must only ever be
    // called by trusted server-side code (verify-delivery-otp,
    // auto-release-escrow), which already authenticate with the service-role
    // key. Reject anything else so a vendor's own session can never invoke it.
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

        const { order_id } = await req.json();

        if (!order_id) {
            throw new Error('order_id is required');
        }

        console.log(`[Transfer to Vendor] Processing order: ${order_id}`);

        // Get order details
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, vendor_id, total_ksh, payout_amount, status')
            .eq('id', order_id)
            .single();

        if (orderError || !order) {
            throw new Error(`Order not found: ${order_id}`);
        }

        if (order.status !== 'completed') {
            throw new Error(`Order is not completed: ${order.status}`);
        }

        // Atomically claim this order for payout so the same order can never
        // be transferred to IntaSend twice, even if this function is called
        // more than once (retry, duplicate cron tick, etc). Only one caller
        // can win this UPDATE.
        const { data: claimed, error: claimError } = await supabase
            .from('orders')
            .update({ payout_transferred_at: new Date().toISOString() })
            .eq('id', order_id)
            .is('payout_transferred_at', null)
            .select('id')
            .maybeSingle();

        if (claimError) {
            throw new Error(`Failed to claim payout lock for order ${order_id}: ${claimError.message}`);
        }
        if (!claimed) {
            console.log(`[Transfer to Vendor] Order ${order_id} already transferred (or a transfer is in progress). Skipping duplicate.`);
            return new Response(
                JSON.stringify({ success: true, skipped: true, reason: 'already_transferred' }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // From here on the order is claimed. Every failure path must decide
        // what happens to the claim and tell admins - nothing retries this
        // automatically, so a silent failure means a vendor silently unpaid.
        try {
            // Get vendor's IntaSend wallet ID
            const { data: vendorBalance } = await supabase
                .from('vendor_balances')
                .select('intasend_wallet_id')
                .eq('vendor_id', order.vendor_id)
                .maybeSingle();

            let vendorWalletId: string | null = vendorBalance?.intasend_wallet_id ?? null;

            if (!vendorWalletId) {
                console.error('[Transfer to Vendor] Vendor has no wallet, attempting to create one...');

                // Try to create wallet for vendor using direct fetch
                const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
                const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

                const createResponse = await fetch(`${supabaseUrl}/functions/v1/create-vendor-wallet`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${serviceRoleKey}`,
                    },
                    body: JSON.stringify({ vendor_id: order.vendor_id }),
                });

                let createResult;
                try {
                    createResult = await createResponse.json();
                } catch (e) {
                    console.error('[Transfer to Vendor] Failed to parse create-wallet response:', e);
                }

                if (!createResponse.ok || !createResult?.wallet_id) {
                    throw new Error(`Vendor has no IntaSend wallet and creation failed`);
                }

                vendorWalletId = createResult.wallet_id as string;
            }

            // Use the payout amount locked in at order creation (correct even
            // if the platform commission rate has changed since); only
            // recompute from the current rate as a fallback for legacy orders
            // that somehow lack a stored payout_amount.
            const orderTotal = Number(order.total_ksh);
            let vendorShare = order.payout_amount != null ? Number(order.payout_amount) : null;
            if (vendorShare === null) {
                const fallbackRate = await getCommissionRatePercent(supabase);
                vendorShare = Math.round(orderTotal * (1 - fallbackRate / 100) * 100) / 100;
            }
            // A vendor can never be owed more than the buyer paid. Anything else
            // means the order row was tampered with - refuse and leave it for admin.
            if (!Number.isFinite(vendorShare) || !Number.isFinite(orderTotal) || vendorShare <= 0 || vendorShare > orderTotal) {
                throw new Error(`Refusing transfer for order ${order_id}: vendor share ${vendorShare} is outside 0..${orderTotal}`);
            }
            const commission = Math.round((orderTotal - vendorShare) * 100) / 100;

            console.log(`[Transfer to Vendor] Order total: ${orderTotal}, Commission: ${commission}, Vendor share: ${vendorShare}`);

            // Transfer from settlement wallet to vendor wallet
            let response: Response;
            let responseText: string;
            try {
                response = await fetch(`https://api.intasend.com/api/v1/wallets/${SETTLEMENT_WALLET_ID}/intra_transfer/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${INTASEND_SECRET_KEY}`,
                    },
                    body: JSON.stringify({
                        wallet_id: vendorWalletId,
                        amount: vendorShare,
                        narrative: `Order ${order_id.slice(0, 8)} - vendor share`,
                    }),
                });
                responseText = await response.text();
            } catch (networkErr) {
                throw new AmbiguousTransferError(
                    `Request to IntaSend failed mid-flight: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`
                );
            }
            console.log(`[Transfer to Vendor] IntaSend response:`, responseText);

            if (!response.ok) {
                // IntaSend answered with an error status: the transfer
                // definitely did not happen, so releasing the claim is safe.
                throw new Error(`IntaSend transfer error (${response.status}): ${responseText.substring(0, 500)}`);
            }

            try {
                JSON.parse(responseText);
            } catch {
                throw new AmbiguousTransferError(`IntaSend returned ${response.status} with invalid JSON: ${responseText.substring(0, 200)}`);
            }

            console.log(`[Transfer to Vendor] Successfully transferred ${vendorShare} to vendor wallet ${vendorWalletId}`);

            // IMPORTANT: We do NOT manually increment pending_balance here anymore.
            // The PostgreSQL trigger 'order_completed_balance_trigger' automatically increments
            // the vendor_balances table when the order status changes to 'completed'.
            // Doing it here caused the balance to double-count.

            return new Response(
                JSON.stringify({
                    success: true,
                    order_id: order_id,
                    vendor_share: vendorShare,
                    commission: commission,
                    vendor_wallet_id: vendorWalletId,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        } catch (claimedErr) {
            const ambiguous = claimedErr instanceof AmbiguousTransferError;
            let claimStatus: string;

            if (ambiguous) {
                // The money may already have moved - keep the claim so a
                // retry can't pay the vendor twice.
                claimStatus = "KEPT - check the IntaSend settlement wallet first. If the transfer did NOT go through, clear payout_transferred_at on this order and retry.";
            } else {
                // The transfer definitely didn't happen - release the claim
                // so a retry can attempt this order again.
                const { error: releaseError } = await supabase
                    .from('orders')
                    .update({ payout_transferred_at: null })
                    .eq('id', order_id);
                if (releaseError) console.error(`[Transfer to Vendor] Failed to release claim for ${order_id}:`, releaseError);
                claimStatus = releaseError
                    ? `NOT released (${releaseError.message}) - clear payout_transferred_at manually before retrying`
                    : "released - safe to retry";
            }

            await alertAdmins(
                supabase,
                ambiguous
                    ? `Vendor payout UNCERTAIN for order ${order_id.slice(0, 8)}`
                    : `Vendor payout failed for order ${order_id.slice(0, 8)}`,
                ambiguous
                    ? "We could not confirm whether a vendor share reached the vendor's wallet. Verify in IntaSend before doing anything else."
                    : "A completed order's vendor share was NOT transferred. Nothing retries this automatically - fix the cause and retry the payout.",
                {
                    "Order ID": order_id,
                    "Vendor ID": order.vendor_id,
                    "Order total (KES)": order.total_ksh,
                    "Error": claimedErr instanceof Error ? claimedErr.message : String(claimedErr),
                    "Payout lock": claimStatus,
                },
            );
            throw claimedErr;
        }

    } catch (error) {
        console.error('[Transfer to Vendor] Error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to transfer funds'
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
