/**
 * Verify 6-Digit OTP & Release Funds (V2)
 *
 * Called when the VENDOR enters the 6-digit OTP shown on the buyer's screen.
 * The buyer receives this OTP after entering the 3-digit Package PIN.
 * If OTP matches:
 * 1. Order status → 'completed'
 * 2. Escrow → 'released'
 * 3. Payout record created for the vendor
 * 4. Funds transferred to vendor's IntaSend wallet
 *
 * Works for BOTH delivery and pickup orders.
 * For pickup: buyer enters PIN (skipped), gets OTP, shows vendor → vendor enters here.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the user from the authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing auth header');

        const token = authHeader.replace('Bearer ', '');
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token format');

        const payload = JSON.parse(atob(parts[1]));
        const userId = payload.sub;

        if (!userId) throw new Error('Invalid user token');

        const { orderId, otp } = await req.json();

        if (!orderId) throw new Error('Missing orderId');
        if (!otp) throw new Error('Missing OTP');

        // Validate OTP format (6 digits)
        if (!/^\d{6}$/.test(otp)) {
            throw new Error('Invalid OTP format - must be 6 digits');
        }

        // Fetch order with escrow info
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("*, escrow_transactions(*)")
            .eq("id", orderId)
            .single();

        if (orderError || !order) throw new Error('Order not found');
        if (order.vendor_id !== userId) throw new Error('Unauthorized — not your order');
        if (order.status === 'completed') throw new Error('Order already completed');

        // Order must be in 'delivered' status (buyer already entered the PIN)
        const validStatuses = ['delivered', 'arrived', 'shipped']; // backwards-compat
        if (!validStatuses.includes(order.status)) {
            throw new Error(`Cannot verify OTP for order in status: ${order.status}. Buyer must receive package first.`);
        }

        // Check if OTP exists
        if (!order.delivery_otp) {
            throw new Error('No OTP available for this order. Buyer must enter the Package PIN first.');
        }

        // Check if OTP was already verified
        if (order.otp_verified_at) {
            throw new Error('OTP already verified for this order');
        }

        // Verify OTP matches
        if (order.delivery_otp !== otp) {
            console.log(`OTP mismatch for order ${orderId}: expected ${order.delivery_otp}, got ${otp}`);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Invalid OTP. Please check the code and try again."
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`OTP verified for order ${orderId}. Proceeding with fund release.`);

        const now = new Date().toISOString();

        // A. Update Order - mark as completed with OTP verification
        const { error: updateOrderError } = await supabase
            .from("orders")
            .update({
                status: "completed",
                buyer_confirmed: true,
                vendor_confirmed: true,
                completed_at: now,
                otp_verified_at: now,
            })
            .eq("id", orderId);

        if (updateOrderError) throw updateOrderError;

        // B. Update Escrow
        const { error: updateEscrowError } = await supabase
            .from("escrow_transactions")
            .update({
                status: "released",
                released_at: now,
            })
            .eq("order_id", orderId);

        if (updateEscrowError) {
            console.error('Escrow update failed (non-critical):', updateEscrowError);
        }

        // C. Create Payout Record
        const payoutAmount = order.payout_amount ?? (order.total_ksh * 0.94);
        const commissionAmount = order.commission_amount ?? (order.total_ksh * 0.06);

        console.log(`Creating payout: vendor=${order.vendor_id}, order=${orderId}, amount=${payoutAmount}`);

        const { error: payoutError } = await supabase
            .from("payouts")
            .insert({
                vendor_id: order.vendor_id,
                order_id: orderId,
                amount_ksh: payoutAmount,
                commission_amount: commissionAmount,
                status: "pending",
                method: "mpesa"
            });

        if (payoutError) {
            console.error('Failed to create payout record:', payoutError);
        } else {
            console.log(`Payout created for order ${orderId}: ${payoutAmount} KES`);
        }

        // D. Record commission in ledger
        const { error: commissionError } = await supabase
            .from("commission_ledger")
            .insert({
                order_id: orderId,
                vendor_id: order.vendor_id,
                commission_rate: order.commission_rate || 6,
                commission_amount: commissionAmount,
                notes: "Funds released via vendor OTP entry",
            });

        if (commissionError) {
            console.error("Failed to record commission:", commissionError);
        }

        // E. Transfer funds to vendor's IntaSend wallet (non-blocking)
        console.log(`Initiating fund transfer to vendor wallet for order ${orderId}`);
        supabase.functions.invoke('transfer-to-vendor-wallet', {
            body: { order_id: orderId }
        }).then((result: { data?: { success?: boolean; vendor_share?: number }; error?: Error }) => {
            if (result.error) {
                console.error('Fund transfer to vendor wallet failed:', result.error);
            } else if (result.data?.success) {
                console.log(`Fund transfer successful: ${result.data.vendor_share} KES`);
            }
        }).catch((err: Error) => {
            console.error('Fund transfer exception:', err);
        });

        // E2. Send completion email notifications (non-blocking)
        console.log(`Initiating completion notifications for order ${orderId}`);
        supabase.functions.invoke('notify-order-completed', {
            body: { orderId: orderId }
        }).catch((err: Error) => {
            console.error('Failed to trigger notify-order-completed:', err);
        });

        // F. Decrement Stock for each order item
        const { data: orderItems, error: itemsError } = await supabase
            .from("order_items")
            .select("product_id, quantity")
            .eq("order_id", orderId);

        if (itemsError) {
            console.error("Failed to fetch order items for stock update:", itemsError);
        } else if (orderItems && orderItems.length > 0) {
            console.log(`Updating stock for ${orderItems.length} items`);
            for (const item of orderItems) {
                const { data: product, error: productError } = await supabase
                    .from("products")
                    .select("stock")
                    .eq("id", item.product_id)
                    .single();

                if (productError || !product) {
                    console.error(`Failed to fetch product ${item.product_id}:`, productError);
                    continue;
                }

                if (product.stock !== null && typeof product.stock === "number") {
                    const newStock = Math.max(0, product.stock - item.quantity);
                    const { error: updateError } = await supabase
                        .from("products")
                        .update({ stock: newStock })
                        .eq("id", item.product_id);

                    if (updateError) {
                        console.error(`Failed to update stock for product ${item.product_id}:`, updateError);
                    } else {
                        console.log(`Stock updated for product ${item.product_id}: ${product.stock} -> ${newStock}`);
                    }
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Delivery confirmed! Funds have been released to your account.",
                payoutAmount: payoutAmount,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error verifying delivery OTP:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
