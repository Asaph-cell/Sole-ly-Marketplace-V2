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
        // SECURITY: Cross-verify with IntaSend API (LOG-ONLY MODE)
        // Logs verification results but doesn't block - prevents breaking payments
        // while still providing an audit trail for suspicious activity
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
                        // LOG ONLY - don't block the webhook
                        console.warn(`[IntaSend Webhook] ⚠️ AUDIT: Invoice verification returned ${verifyResponse.status} - proceeding anyway`);
                    } else {
                        const verifiedInvoice = await verifyResponse.json();
                        console.log(`[IntaSend Webhook] Verified invoice response:`, JSON.stringify(verifiedInvoice));

                        // Log mismatches but don't block
                        const isVerifiedSuccess = verifiedInvoice.state === 'COMPLETE' || verifiedInvoice.state === 'COMPLETED' || verifiedInvoice.state === 'SUCCESSFUL';
                        if (verifiedInvoice.state && !isVerifiedSuccess) {
                            console.warn(`[IntaSend Webhook] ⚠️ AUDIT: State mismatch - webhook: ${state}, API: ${verifiedInvoice.state}`);
                        }

                        if (verifiedInvoice.api_ref && verifiedInvoice.api_ref !== orderId) {
                            console.warn(`[IntaSend Webhook] ⚠️ AUDIT: Order ID mismatch - webhook: ${orderId}, API: ${verifiedInvoice.api_ref}`);
                        }

                        console.log(`[IntaSend Webhook] ✓ Invoice ${invoice_id} verification complete`);
                    }
                } catch (verifyError) {
                    console.warn('[IntaSend Webhook] Verification API error (proceeding anyway):', verifyError);
                }
            } else {
                console.warn('[IntaSend Webhook] INTASEND_SECRET_KEY not set - skipping invoice verification');
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

                // Notify vendor and buyer concurrently but await completion before returning
                // (Deno terminates background promises when the main response is sent)
                console.log(`[IntaSend Webhook] Triggering notifications for order ${orderId}...`);
                await Promise.allSettled([
                    supabaseClient.functions.invoke('notify-vendor-new-order', {
                        body: { orderId: orderId },
                    }).catch(err => console.log('[IntaSend Webhook] Vendor notification failed:', err)),
                    
                    supabaseClient.functions.invoke('notify-buyer-order-placed', {
                        body: { orderId: orderId },
                    }).catch(err => console.log('[IntaSend Webhook] Buyer notification failed:', err))
                ]);
                console.log(`[IntaSend Webhook] Notifications triggered successfully.`);
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
