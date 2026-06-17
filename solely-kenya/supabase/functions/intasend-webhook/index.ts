import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Always return 200 for OPTIONS (CORS preflight)
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    console.log('[IntaSend Webhook] Received request:', req.method);

    try {
        // Read body as text first for safe parsing
        const bodyText = await req.text();
        console.log('[IntaSend Webhook] Body length:', bodyText.length, 'Body preview:', bodyText.substring(0, 200));

        // Handle empty body (IntaSend test pings or health checks)
        if (!bodyText || bodyText.trim() === '') {
            console.log('[IntaSend Webhook] Empty body - responding with success (ping/health check)');
            return new Response(
                JSON.stringify({ success: true, message: 'Webhook endpoint active' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Safely parse JSON
        let payload;
        try {
            payload = JSON.parse(bodyText);
        } catch (parseError) {
            console.error('[IntaSend Webhook] JSON parse error:', parseError, 'Body was:', bodyText.substring(0, 500));
            // Return 200 to acknowledge receipt - don't cause retry loops
            return new Response(
                JSON.stringify({ success: true, message: 'Acknowledged' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('[IntaSend Webhook] Parsed payload:', JSON.stringify(payload, null, 2));

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // IntaSend webhook payload structure:
        // {
        //   "invoice_id": "XXXXXXX",
        //   "state": "COMPLETE" | "FAILED" | "PENDING",
        //   "api_ref": "order_id",
        //   "value": 5000,
        //   "account": "254712345678",
        //   "name": "John Doe",
        //   "retail_price": 5000,
        //   "net_amount": 4850,
        //   "currency": "KES",
        //   "failed_reason": "...",
        //   "created_at": "2026-01-11T18:00:00Z",
        //   "updated_at": "2026-01-11T18:05:00Z"
        // }

        const {
            invoice_id,
            state,
            api_ref,
            value,
            account,
            name,
            retail_price,
            net_amount,
            currency,
            failed_reason,
            created_at,
            updated_at
        } = payload;

        if (!api_ref) {
            console.log('[IntaSend Webhook] No api_ref in payload - likely a test or notification webhook');
            return new Response(
                JSON.stringify({ success: true, message: 'Acknowledged (no api_ref)' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const orderId = api_ref;
        console.log(`[IntaSend Webhook] Processing payment for order: ${orderId}, state: ${state}`);

        // ─────────────────────────────────────────────────────────────────────
        // SECURITY: Cross-verify with IntaSend API (ENFORCED)
        // If IntaSend's own API disagrees with the webhook state, we reject the
        // payload entirely. Returning 200 so IntaSend doesn't retry, but we do
        // NOT update the order — blocking spoofed "COMPLETE" webhook attacks.
        // ─────────────────────────────────────────────────────────────────────
        if (invoice_id && (state === 'COMPLETE' || state === 'COMPLETED' || state === 'SUCCESSFUL')) {
            const intaSendSecretKey = Deno.env.get('INTASEND_SECRET_KEY');

            if (intaSendSecretKey) {
                try {
                    console.log(`[IntaSend Webhook] Verifying invoice ${invoice_id} with IntaSend API...`);

                    const verifyResponse = await fetch(`https://api.intasend.com/api/v1/invoices/${invoice_id}/`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${intaSendSecretKey}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    if (!verifyResponse.ok) {
                        // Cannot reach IntaSend API — reject to be safe
                        console.error(`[IntaSend Webhook] ❌ REJECTED: Could not verify invoice ${invoice_id} (HTTP ${verifyResponse.status}). Aborting.`);
                        return new Response(
                            JSON.stringify({ success: false, message: 'Webhook rejected: could not verify invoice with IntaSend' }),
                            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        );
                    }

                    const verifiedInvoice = await verifyResponse.json();
                    const isVerifiedSuccess = verifiedInvoice.state === 'COMPLETE' || verifiedInvoice.state === 'COMPLETED' || verifiedInvoice.state === 'SUCCESSFUL';

                    if (!isVerifiedSuccess) {
                        // IntaSend says it's NOT paid — this is a spoofed or replayed webhook
                        console.error(`[IntaSend Webhook] ❌ REJECTED: State mismatch — webhook claimed: ${state}, IntaSend API says: ${verifiedInvoice.state}. Possible spoofed webhook. Order ${orderId} NOT updated.`);
                        return new Response(
                            JSON.stringify({ success: false, message: 'Webhook rejected: payment state mismatch' }),
                            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        );
                    }

                    if (verifiedInvoice.api_ref && verifiedInvoice.api_ref !== orderId) {
                        // The invoice belongs to a different order — replay attack
                        console.error(`[IntaSend Webhook] ❌ REJECTED: Order ID mismatch — webhook: ${orderId}, IntaSend API: ${verifiedInvoice.api_ref}. Possible replay attack.`);
                        return new Response(
                            JSON.stringify({ success: false, message: 'Webhook rejected: order ID mismatch' }),
                            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        );
                    }

                    console.log(`[IntaSend Webhook] ✅ Invoice ${invoice_id} verified successfully. Proceeding.`);

                } catch (verifyError) {
                    // Network error reaching IntaSend — fail safe, reject
                    console.error('[IntaSend Webhook] ❌ REJECTED: Verification network error:', verifyError);
                    return new Response(
                        JSON.stringify({ success: false, message: 'Webhook rejected: verification error' }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            } else {
                // No secret key configured — cannot verify, must reject
                console.error('[IntaSend Webhook] ❌ REJECTED: INTASEND_SECRET_KEY not set — cannot verify webhook. Configure the key to process payments.');
                return new Response(
                    JSON.stringify({ success: false, message: 'Webhook rejected: verification not configured' }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }


        // Fetch the order
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('id, total_ksh, status')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            console.error('[IntaSend Webhook] Order not found:', orderId, orderError);
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Update payment record
        const isSuccess = state === 'COMPLETE' || state === 'COMPLETED' || state === 'SUCCESSFUL';
        const { error: paymentUpdateError } = await supabaseClient
            .from('payments')
            .update({
                status: isSuccess ? 'captured' : state === 'FAILED' ? 'pending' : 'pending',
                transaction_id: invoice_id,
                captured_at: isSuccess ? new Date().toISOString() : undefined,
            })
            .eq('order_id', orderId)
            .eq('gateway', 'intasend');

        if (paymentUpdateError) {
            console.error('[IntaSend Webhook] Failed to update payment:', paymentUpdateError);
        }

        // Handle based on payment state
        if (isSuccess) {
            console.log(`[IntaSend Webhook] Payment successful for order ${orderId}`);

            // Update order status to confirmed (waiting for vendor to accept)
            const { error: orderUpdateError } = await supabaseClient
                .from('orders')
                .update({
                    status: 'pending_vendor_confirmation',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orderId);

            if (orderUpdateError) {
                console.error('[IntaSend Webhook] Failed to update order status:', orderUpdateError);
            } else {
                console.log(`[IntaSend Webhook] Order ${orderId} status updated to pending_vendor_confirmation`);

                // Decrement stock for each order item when payment is confirmed
                const { data: orderItems, error: itemsError } = await supabaseClient
                    .from('order_items')
                    .select('product_id, quantity')
                    .eq('order_id', orderId);

                if (itemsError) {
                    console.error('[IntaSend Webhook] Failed to fetch order items:', itemsError);
                } else if (orderItems && orderItems.length > 0) {
                    console.log(`[IntaSend Webhook] Decrementing stock for ${orderItems.length} items`);
                    for (const item of orderItems) {
                        if (!item.product_id) continue;
                        
                        const { data: product, error: productError } = await supabaseClient
                            .from('products')
                            .select('stock')
                            .eq('id', item.product_id)
                            .single();

                        if (!productError && product && product.stock !== null && typeof product.stock === 'number') {
                            const newStock = Math.max(0, product.stock - item.quantity);
                            await supabaseClient
                                .from('products')
                                .update({ stock: newStock })
                                .eq('id', item.product_id);
                            console.log(`[IntaSend Webhook] Stock for ${item.product_id}: ${product.stock} -> ${newStock}`);
                        }
                    }
                }

                // Notify vendor and buyer concurrently using direct fetch
                // (supabaseClient.functions.invoke() silently fails from within Edge Functions)
                console.log(`[IntaSend Webhook] Triggering notifications for order ${orderId}...`);
                const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
                const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
                
                const notifyResults = await Promise.allSettled([
                    fetch(`${supabaseUrl}/functions/v1/notify-vendor-new-order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${serviceRoleKey}`,
                        },
                        body: JSON.stringify({ orderId: orderId }),
                    }).then(async (res) => {
                        const text = await res.text();
                        console.log(`[IntaSend Webhook] Vendor notification response (${res.status}):`, text);
                        return { status: res.status, body: text };
                    }).catch(err => {
                        console.error('[IntaSend Webhook] Vendor notification fetch failed:', err);
                        throw err;
                    }),
                    
                    fetch(`${supabaseUrl}/functions/v1/notify-buyer-order-placed`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${serviceRoleKey}`,
                        },
                        body: JSON.stringify({ orderId: orderId }),
                    }).then(async (res) => {
                        const text = await res.text();
                        console.log(`[IntaSend Webhook] Buyer notification response (${res.status}):`, text);
                        return { status: res.status, body: text };
                    }).catch(err => {
                        console.error('[IntaSend Webhook] Buyer notification fetch failed:', err);
                        throw err;
                    }),
                ]);
                
                console.log(`[IntaSend Webhook] Notification results:`, JSON.stringify(notifyResults.map(r => r.status)));
            }

        } else if (state === 'FAILED') {
            console.log(`[IntaSend Webhook] Payment failed for order ${orderId}. Reason: ${failed_reason || 'Unknown'}`);

            // Update order status to payment failed
            const { error: orderUpdateError } = await supabaseClient
                .from('orders')
                .update({
                    status: 'payment_failed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orderId);

            if (orderUpdateError) {
                console.error('[IntaSend Webhook] Failed to update order status:', orderUpdateError);
            }

        } else {
            console.log(`[IntaSend Webhook] Payment pending for order ${orderId}`);
        }

        // Return success response to IntaSend
        return new Response(
            JSON.stringify({ success: true, message: 'Webhook processed' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[IntaSend Webhook] Error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
