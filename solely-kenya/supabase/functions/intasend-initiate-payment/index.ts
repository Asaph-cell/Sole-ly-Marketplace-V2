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

        const { orderId, successUrl, cancelUrl } = await req.json();

        if (!orderId) {
            throw new Error('Order ID is required');
        }

        console.log(`[IntaSend] Creating checkout for order: ${orderId}`);

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
        const email = shipping?.email || order.profiles?.email || 'customer@solelymarketplace.com';
        const phone = shipping?.phone || '';
        const name = shipping?.recipient_name || order.profiles?.full_name || 'Customer';
        const amount = Number(order.total_ksh);

        if (isNaN(amount) || amount <= 0) {
            throw new Error(`Invalid order amount: ${order.total_ksh}`);
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

        const payload: Record<string, unknown> = {
            public_key: Deno.env.get('INTASEND_PUBLISHABLE_KEY'),
            amount: amount,
            currency: 'KES',
            email: email,
            first_name: firstName,
            last_name: lastName,
            api_ref: orderId,
            redirect_url: successUrl || cancelUrl || 'https://solelymarketplace.com/orders',
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
