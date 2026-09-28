import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { rateLimit } from "../_shared/rate-limit.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, amountKsh } = await req.json();
    const limited = await rateLimit(req, corsHeaders, { name: "stripe-intent", max: 10, windowSeconds: 600 });
    if (limited) return limited;

    if (!orderId || !amountKsh) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId or amountKsh' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, payments(id, status)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Check if payment already exists and is pending
    const existingPayment = order.payments?.[0];
    if (existingPayment && existingPayment.status === 'pending') {
      // Return existing payment intent if available
      const { data: payment } = await supabase
        .from('payments')
        .select('metadata')
        .eq('id', existingPayment.id)
        .single();

      if (payment?.metadata?.stripe_payment_intent_id) {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          payment.metadata.stripe_payment_intent_id as string
        );
        return new Response(
          JSON.stringify({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Convert KES to USD for Stripe (approximate rate, should use real-time rate in production)
    // 1 KES ≈ 0.0065 USD (adjust as needed)
    const exchangeRate = 0.0065;
    const amountUsd = Math.round(amountKsh * exchangeRate * 100); // Convert to cents

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountUsd,
      currency: 'usd',
      metadata: {
        order_id: orderId,
        amount_ksh: amountKsh.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Update payment record with Stripe payment intent ID
    if (existingPayment) {
      await supabase
        .from('payments')
        .update({
          transaction_reference: paymentIntent.id,
          metadata: {
            stripe_payment_intent_id: paymentIntent.id,
            amount_usd: amountUsd / 100,
            exchange_rate: exchangeRate,
          },
        })
        .eq('id', existingPayment.id);
    } else {
      // Create new payment record if it doesn't exist
      await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          gateway: 'card',
          status: 'pending',
          transaction_reference: paymentIntent.id,
          amount_ksh: amountKsh,
          currency: 'KES',
          metadata: {
            stripe_payment_intent_id: paymentIntent.id,
            amount_usd: amountUsd / 100,
            exchange_rate: exchangeRate,
          },
        });
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating Stripe payment intent:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to create payment intent' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

