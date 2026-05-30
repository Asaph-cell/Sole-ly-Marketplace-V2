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
    const payload = await req.json();
    console.log('M-Pesa callback received:', JSON.stringify(payload, null, 2));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { Body } = payload;
    const { stkCallback } = Body;

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = stkCallback;

    console.log('Processing callback for CheckoutRequestID:', CheckoutRequestID);

    // Get payment record by checkout request ID
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*, orders(id, status, total_ksh, commission_amount, payout_amount)')
      .eq('transaction_reference', CheckoutRequestID)
      .eq('gateway', 'mpesa')
      .single();

    if (fetchError || !payment) {
      console.error('Error fetching payment:', fetchError);
      // Try legacy mpesa_transactions table for backward compatibility
      const { data: legacyTransaction } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .eq('checkout_request_id', CheckoutRequestID)
        .single();

      if (legacyTransaction) {
        // Handle legacy subscription payments
        return new Response(
          JSON.stringify({ success: true, message: 'Legacy transaction processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (ResultCode === 0) {
      // Payment successful
      console.log('M-Pesa payment successful for order:', payment.order_id);

      // Extract payment details from callback metadata
      let mpesaReceiptNumber = '';
      let transactionDate = '';

      if (CallbackMetadata && CallbackMetadata.Item) {
        for (const item of CallbackMetadata.Item) {
          if (item.Name === 'MpesaReceiptNumber') {
            mpesaReceiptNumber = item.Value;
          } else if (item.Name === 'TransactionDate') {
            transactionDate = item.Value.toString();
          }
        }
      }

      // Update payment status
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'captured',
          captured_at: new Date().toISOString(),
          transaction_reference: mpesaReceiptNumber || CheckoutRequestID,
          metadata: {
            ...(payment.metadata || {}),
            mpesa_receipt_number: mpesaReceiptNumber,
            transaction_date: transactionDate,
            merchant_request_id: MerchantRequestID,
            result_code: ResultCode,
            result_desc: ResultDesc,
          },
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('Error updating payment:', updateError);
      }

      // Check if this is a delivery fee payment
      const isDeliveryFee = payment.metadata?.is_delivery_fee === true;
      
      if (isDeliveryFee) {
        // This is an additional payment for delivery fee
        // Get the order to update escrow with new totals
        const { data: order } = await supabase
          .from('orders')
          .select('total_ksh, commission_amount, payout_amount')
          .eq('id', payment.order_id)
          .single();

        if (order) {
          // Update escrow transaction with new totals
          const { data: escrow } = await supabase
            .from('escrow_transactions')
            .select('id, held_amount')
            .eq('order_id', payment.order_id)
            .single();

          if (escrow) {
            await supabase
              .from('escrow_transactions')
              .update({
                held_amount: order.total_ksh,
                commission_amount: order.commission_amount,
                release_amount: order.payout_amount,
              })
              .eq('id', escrow.id);
          }
        }
      } else {
        // This is the initial payment
        // Update order status to pending_vendor_confirmation
        if (payment.orders) {
          await supabase
            .from('orders')
            .update({
              status: 'pending_vendor_confirmation',
            })
            .eq('id', payment.order_id);

          // Ensure escrow transaction exists
          const { data: escrow } = await supabase
            .from('escrow_transactions')
            .select('id')
            .eq('order_id', payment.order_id)
            .single();

          if (!escrow && payment.orders) {
            await supabase
              .from('escrow_transactions')
              .insert({
                order_id: payment.order_id,
                payment_id: payment.id,
                status: 'held',
                held_amount: payment.orders.total_ksh,
                commission_amount: payment.orders.commission_amount,
                release_amount: payment.orders.payout_amount,
              });
          }
        }
      }

      console.log(`M-Pesa payment processed successfully for order ${payment.order_id}`);
    } else {
      // Payment failed
      console.log('M-Pesa payment failed:', ResultDesc);

      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'pending', // Keep as pending for retry
          metadata: {
            ...(payment.metadata || {}),
            result_code: ResultCode,
            result_desc: ResultDesc,
            merchant_request_id: MerchantRequestID,
          },
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('Error updating failed payment:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Callback processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in mpesa-callback:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
