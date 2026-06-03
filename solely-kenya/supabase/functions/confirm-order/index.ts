/**
 * Confirm Order & Release Funds
 * 
 * Called when buyer confirms receipt of goods.
 * 1. Updates order status to 'completed'
 * 2. Updates escrow transaction to 'released'
 * 3. Creates a PAYOUT record for the vendor (Critical for accessing funds)
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

        // Service role client for database operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the user from the authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing auth header');

        const token = authHeader.replace('Bearer ', '');

        // Decode JWT to get user ID (JWT payload is base64 encoded)
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token format');

        const payload = JSON.parse(atob(parts[1]));
        const userId = payload.sub;

        if (!userId) throw new Error('Invalid user token');

        console.log(`User ID from token: ${userId}`);

        const { orderId, rating, review } = await req.json();

        if (!orderId) throw new Error('Missing orderId');

        // 1. Fetch Order to verify ownership and amount
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("*, escrow_transactions(*)")
            .eq("id", orderId)
            .single();

        if (orderError || !order) throw new Error('Order not found');
        if (order.customer_id !== userId) throw new Error('Unauthorized');
        if (order.status === 'completed') throw new Error('Order already completed');

        console.log(`Confirming order ${orderId} for user ${userId}`);

        // 2. Transact: Update Order, Escrow, and Create Payout
        // We do this sequentially since Supabase HTTP clients don't support SQL transactions easily in JS
        // But we use the service role key so RLS won't block us

        // A. Update Order
        const { error: updateOrderError } = await supabase
            .from("orders")
            .update({
                status: "completed",
                buyer_confirmed: true,
                confirmed_at: new Date().toISOString()
            })
            .eq("id", orderId);

        if (updateOrderError) throw updateOrderError;

        // B. Update Escrow
        const { error: updateEscrowError } = await supabase
            .from("escrow_transactions")
            .update({
                status: "released",
                released_at: new Date().toISOString()
            })
            .eq("order_id", orderId);

        if (updateEscrowError) console.error('Escrow update failed (non-critical if order is completed):', updateEscrowError);

        // C. Create Payout Record (CRITICAL MISSING STEP)
        // Calculate 94% of total order value (assuming 6% commission) - or use stored commission
        const payoutAmount = order.payout_amount ?? (order.total_ksh * 0.94);
        const commissionAmount = order.commission_amount ?? (order.total_ksh * 0.06);

        console.log(`Creating payout: vendor=${order.vendor_id}, order=${orderId}, amount=${payoutAmount}, commission=${commissionAmount}`);

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
            console.error('Failed to create payout record:', JSON.stringify(payoutError));
            // Don't throw - just log the error and continue
        } else {
            console.log(`Payout created for order ${orderId}: ${payoutAmount} KES (commission: ${commissionAmount} KES)`);
        }

        // D. Record commission in ledger (for admin dashboard tracking)
        const { error: commissionError } = await supabase
            .from("commission_ledger")
            .insert({
                order_id: orderId,
                vendor_id: order.vendor_id,
                commission_rate: 6, // 6% commission
                commission_amount: commissionAmount,
                notes: "Buyer confirmed delivery",
            });

        if (commissionError) {
            console.error("Failed to record commission:", commissionError);
            // Don't throw - just log
        } else {
            console.log(`Commission recorded: ${commissionAmount} KES`);
        }

        // F. Transfer funds to vendor's IntaSend wallet (non-blocking)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        
        console.log(`[Confirm Order] Triggering transfer-to-vendor-wallet for order ${orderId}...`);
        fetch(`${supabaseUrl}/functions/v1/transfer-to-vendor-wallet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ order_id: orderId }),
        }).catch(err => console.error('[Confirm Order] Failed to trigger transfer:', err));

        // E. Decrement Stock for each order item
        const { data: orderItems, error: itemsError } = await supabase
            .from("order_items")
            .select("product_id, quantity")
            .eq("order_id", orderId);

        if (itemsError) {
            console.error("Failed to fetch order items for stock update:", itemsError);
        } else if (orderItems && orderItems.length > 0) {
            console.log(`Updating stock for ${orderItems.length} items`);
            for (const item of orderItems) {
                // Get current stock
                const { data: product, error: productError } = await supabase
                    .from("products")
                    .select("stock")
                    .eq("id", item.product_id)
                    .single();

                if (productError || !product) {
                    console.error(`Failed to fetch product ${item.product_id} for stock update:`, productError);
                    continue;
                }

                // Only update if stock is tracked (not null)
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

        // D. Add Rating (Optional)
        if (rating && rating > 0) {
            try {
                const { error: ratingError } = await supabase
                    .from("vendor_ratings")
                    .insert({
                        order_id: orderId,
                        buyer_id: userId,
                        vendor_id: order.vendor_id,
                        rating,
                        review: review || null,
                    });

                if (ratingError) {
                    console.error("Failed to insert vendor rating:", ratingError);
                } else {
                    console.log(`Rating added for order ${orderId}: ${rating} stars`);
                }
            } catch (err) {
                console.error("Exception adding vendor rating:", err);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Order confirmed and funds released",
                ratingStatus: (rating && rating > 0) ? "attempted" : "skipped"
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error confirming order:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
