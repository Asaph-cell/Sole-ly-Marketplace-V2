/**
 * Transfer to Vendor Wallet
 * Transfers vendor's share (minus commission) from settlement to vendor wallet
 * Called after order completion
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_COMMISSION_RATE = 0.06; // 6%
const SETTLEMENT_WALLET_ID = Deno.env.get('INTASEND_SETTLEMENT_WALLET_ID') || 'KZRJ8VY';

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

        // Get vendor's IntaSend wallet ID
        const { data: vendorBalance, error: balanceError } = await supabase
            .from('vendor_balances')
            .select('intasend_wallet_id')
            .eq('vendor_id', order.vendor_id)
            .single();

        if (balanceError || !vendorBalance?.intasend_wallet_id) {
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

            vendorBalance.intasend_wallet_id = createResult.wallet_id;
        }

        const vendorWalletId = vendorBalance.intasend_wallet_id;

        // Calculate vendor share (order total minus commission)
        const orderTotal = Number(order.total_ksh);
        const commission = Math.round(orderTotal * PLATFORM_COMMISSION_RATE * 100) / 100;
        const vendorShare = Math.round((orderTotal - commission) * 100) / 100;

        console.log(`[Transfer to Vendor] Order total: ${orderTotal}, Commission: ${commission}, Vendor share: ${vendorShare}`);

        // Transfer from settlement wallet to vendor wallet
        const response = await fetch(`https://api.intasend.com/api/v1/wallets/${SETTLEMENT_WALLET_ID}/intra_transfer/`, {
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

        const responseText = await response.text();
        console.log(`[Transfer to Vendor] IntaSend response:`, responseText);

        let transferResult;
        try {
            transferResult = JSON.parse(responseText);
        } catch {
            throw new Error(`IntaSend returned invalid JSON: ${responseText.substring(0, 200)}`);
        }

        if (!response.ok) {
            throw new Error(`IntaSend transfer error: ${JSON.stringify(transferResult)}`);
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
