/**
 * DEPRECATED: process-delivery-fee-payment
 * 
 * This edge function is no longer used. Delivery fees are now handled through
 * the delivery_agreements table and included in the single IntaSend checkout
 * transaction. The buyer and vendor negotiate the delivery fee via in-app chat,
 * and the agreed fee is added to the order total at checkout.
 * 
 * This file is kept as a stub to prevent deployment errors if the function
 * is still registered in Supabase. It will return a 410 Gone response.
 * 
 * Safe to delete entirely once confirmed no clients call this endpoint.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'This endpoint is deprecated. Delivery fees are now negotiated in-app and included in the checkout total.',
      status: 'gone',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
