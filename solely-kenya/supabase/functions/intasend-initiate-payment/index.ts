import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json();
        const { successUrl, cancelUrl, checkoutPayload } = body;
        let orderId = body.orderId;

        let email = 'customer@solelymarketplace.com';
        let phone = '';
        let name = 'Customer';
        let amount = 0;

        if (!orderId && checkoutPayload) {
            // Create a new order server-side to bypass guest RLS limitations
            const {
                paymentLinkId,
                buyerName,
                buyerPhone,
                buyerEmail,
                address,
                city,
                county,
                gpsLat,
                gpsLng,
                googleMapsLink,
                notes,
                customerId
            } = checkoutPayload;

            if (!paymentLinkId || !buyerName || !buyerPhone || !address || !city) {
                throw new Error('Missing required checkout payload fields');
            }

            console.log(`[IntaSend] Creating order and checkout for link: ${paymentLinkId}`);

            // Fetch payment link
            const { data: paymentLink, error: linkError } = await supabaseClient
                .from('payment_links')
                .select('*, product:product_id(*)')
                .eq('id', paymentLinkId)
                .single();

            if (linkError || !paymentLink) {
                console.error('[IntaSend] Payment link error:', linkError);
                throw new Error('Payment link not found or is inactive');
            }

            const itemTitle = paymentLink.product ? paymentLink.product.name : paymentLink.custom_title;
            const itemPrice = paymentLink.product ? paymentLink.product.price_ksh : paymentLink.custom_price_ksh;
            const deliveryFee = paymentLink.delivery_fee_ksh || 0;
            const total = itemPrice + deliveryFee;
            const commissionRate = 6;
            const commissionAmount = total * 0.06;
            const payoutAmount = total - commissionAmount;

            // 1. Insert order
            const { data: newOrder, error: newOrderError } = await supabaseClient
                .from('orders')
                .insert({
                    customer_id: customerId || null,
                    vendor_id: paymentLink.vendor_id,
                    payment_link_id: paymentLink.id,
                    subtotal_ksh: itemPrice,
                    shipping_fee_ksh: deliveryFee,
                    total_ksh: total,
                    status: 'pending_payment',
                    commission_rate: commissionRate,
                    commission_amount: commissionAmount,
                    payout_amount: payoutAmount,
                })
                .select()
                .single();

            if (newOrderError || !newOrder) {
                console.error('[IntaSend] Failed to create order:', newOrderError);
                throw new Error(newOrderError?.message || 'Failed to create secure order');
            }

            orderId = newOrder.id;

            // 2. Insert order items
            const { error: itemsError } = await supabaseClient
                .from('order_items')
                .insert({
                    order_id: orderId,
                    product_id: paymentLink.product_id || null,
                    product_name: itemTitle,
                    product_snapshot: {
                        price_ksh: itemPrice,
                        is_custom_link: !paymentLink.product_id
                    },
                    quantity: 1,
                    unit_price_ksh: itemPrice,
                    line_total_ksh: itemPrice,
                });

            if (itemsError) {
                console.error('[IntaSend] Failed to save order items:', itemsError);
                throw new Error('Failed to save order items: ' + itemsError.message);
            }

            // 3. Insert order shipping details
            const { error: shippingError } = await supabaseClient
                .from('order_shipping_details')
                .insert({
                    order_id: orderId,
                    recipient_name: buyerName,
                    phone: buyerPhone,
                    email: buyerEmail || null,
                    address_line1: address,
                    city: city,
                    county: county || null,
                    gps_latitude: gpsLat || null,
                    gps_longitude: gpsLng || null,
                    delivery_notes: notes || null,
                    country: 'Kenya',
                    delivery_type: 'delivery'
                });

            if (shippingError) {
                console.error('[IntaSend] Failed to save shipping details:', shippingError);
                throw new Error('Failed to save shipping details: ' + shippingError.message);
            }

            // 4. Insert payment
            const { data: newPayment, error: paymentError } = await supabaseClient
                .from('payments')
                .insert({
                    order_id: orderId,
                    gateway: 'intasend',
                    status: 'pending',
                    amount_ksh: total,
                    currency: 'KES',
                })
                .select()
                .single();

            if (paymentError || !newPayment) {
                console.error('[IntaSend] Failed to initialize payment record:', paymentError);
                throw new Error(paymentError?.message || 'Failed to initialize payment tracking');
            }

            // 5. Insert escrow transaction
            const { error: escrowError } = await supabaseClient
                .from('escrow_transactions')
                .insert({
                    order_id: orderId,
                    payment_id: newPayment.id,
                    status: 'held',
                    held_amount: total,
                    commission_amount: commissionAmount,
                    release_amount: payoutAmount,
                });

            if (escrowError) {
                console.error('[IntaSend] Failed to initialize escrow:', escrowError);
                throw new Error('Failed to initialize escrow: ' + escrowError.message);
            }

            email = buyerEmail || 'customer@solelymarketplace.com';
            phone = buyerPhone;
            name = buyerName;
            amount = total;

        } else if (orderId) {
            console.log(`[IntaSend] Creating checkout for existing order: ${orderId}`);

            // 1. Fetch order with customer profile
            const { data: order, error: orderError } = await supabaseClient
                .from('orders')
                .select('total_ksh, customer_id, profiles:customer_id(email, full_name)')
                .eq('id', orderId)
                .single();

            if (orderError || !order) {
                console.error('[IntaSend] Order not found:', orderError);
                throw new Error('Order not found');
            }

            // 2. Fetch shipping details for phone/email
            const { data: shipping } = await supabaseClient
                .from('order_shipping_details')
                .select('email, phone, recipient_name')
                .eq('order_id', orderId)
                .single();

            // 3. Prepare customer data with fallbacks
            email = shipping?.email || order.profiles?.email || 'customer@solelymarketplace.com';
            phone = shipping?.phone || '';
            name = shipping?.recipient_name || order.profiles?.full_name || 'Customer';
            amount = Number(order.total_ksh);
        } else {
            throw new Error('Either orderId or checkoutPayload is required');
        }

        if (isNaN(amount) || amount <= 0) {
            throw new Error(`Invalid order amount: ${amount}`);
        }

        // 4. Format phone number for IntaSend (254XXXXXXXXX format)
        let formattedPhone = phone.replace(/\D/g, ''); // Remove non-digits

        if (formattedPhone.length >= 9) {
            // Handle different formats
            if (formattedPhone.startsWith('254')) {
                // Already correct format
            } else if (formattedPhone.startsWith('0')) {
                // Replace leading 0 with 254
                formattedPhone = '254' + formattedPhone.substring(1);
            } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
                // Add 254 prefix
                formattedPhone = '254' + formattedPhone;
            }
        }

        // Split name for first/last
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || 'Customer';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Buyer';

        // 5. Build IntaSend payload (public_key goes in body, NOT in headers)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const webhookUrl = `${supabaseUrl}/functions/v1/intasend-webhook`;

        let finalSuccessUrl = successUrl || '';
        if (finalSuccessUrl.includes('__ORDER_ID__')) {
            finalSuccessUrl = finalSuccessUrl.replace('__ORDER_ID__', orderId);
        }

        const payload: Record<string, unknown> = {
            public_key: Deno.env.get('INTASEND_PUBLISHABLE_KEY'),
            amount: amount,
            currency: 'KES',
            email: email,
            first_name: firstName,
            last_name: lastName,
            api_ref: orderId,
            redirect_url: finalSuccessUrl || cancelUrl || 'https://solelymarketplace.com/orders',
            webhook_url: webhookUrl, // CRITICAL: This tells IntaSend where to POST payment confirmations
        };

        // Add phone if valid (at least 9 digits after formatting)
        if (formattedPhone.length >= 9) {
            payload.phone_number = formattedPhone;
        }

        // Log request (hide sensitive data)
        console.log('[IntaSend] Request payload:', JSON.stringify({
            ...payload,
            public_key: '[HIDDEN]'
        }));

        // 6. Call IntaSend Checkout API (NO Authorization header needed)
        const response = await fetch('https://api.intasend.com/api/v1/checkout/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const responseText = await response.text();
        console.log('[IntaSend] Raw response:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error('[IntaSend] Invalid JSON response:', responseText.substring(0, 500));
            throw new Error(`IntaSend returned invalid response. Please check your API keys and try again.`);
        }

        if (!response.ok) {
            // Parse detailed error from IntaSend
            let errorMessage = 'Payment initialization failed';

            if (data?.detail) {
                errorMessage = data.detail;
            } else if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                errorMessage = data.errors[0].detail || data.errors[0].message || errorMessage;
            } else if (data?.error) {
                errorMessage = data.error;
            } else if (data?.message) {
                errorMessage = data.message;
            }

            console.error('[IntaSend] API Error:', {
                status: response.status,
                statusText: response.statusText,
                errorData: data,
                errorMessage: errorMessage
            });

            throw new Error(errorMessage);
        }

        if (!data.url) {
            console.error('[IntaSend] No URL in response:', data);
            throw new Error('IntaSend did not return a checkout URL. Please try again.');
        }

        console.log('[IntaSend] Success! Checkout URL:', data.url);

        return new Response(
            JSON.stringify({ success: true, url: data.url }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[IntaSend] Error:', error);

        const errorMessage = error instanceof Error
            ? error.message
            : 'Failed to initialize payment. Please try again.';

        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
