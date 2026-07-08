import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { emailTemplates, sendEmail } from "../_shared/email-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { agreementId } = await req.json();

    if (!agreementId) {
      return new Response(JSON.stringify({ error: "Missing agreementId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize admin client to fetch vendor details
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch the delivery agreement
    const { data: agreement, error: agreementError } = await supabaseAdmin
      .from("delivery_agreements")
      .select("*")
      .eq("id", agreementId)
      .single();

    if (agreementError || !agreement) {
      console.error("Agreement error:", agreementError);
      throw new Error("Delivery agreement not found");
    }

    // Fetch vendor email
    const { data: vendorUser, error: vendorUserError } = await supabaseAdmin.auth.admin.getUserById(
      agreement.vendor_id
    );

    if (vendorUserError || !vendorUser.user) {
      console.error("Vendor user error:", vendorUserError);
      throw new Error("Vendor user not found");
    }

    // Fetch products
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("name")
      .in("id", agreement.product_ids);
      
    if (productsError) {
      console.error("Products fetch error:", productsError);
    }

    const productNames = products ? products.map(p => p.name).join(", ") : "items";
    const appUrl = Deno.env.get("APP_URL") || "https://solelymarketplace.com";
    const vendorEmail = vendorUser.user.email;

    if (!vendorEmail) {
      throw new Error("Vendor has no email");
    }

    // Prepare email
    const html = emailTemplates.vendorDeliveryInquiry({
      buyerName: agreement.buyer_name || "A buyer",
      productNames: productNames,
      city: agreement.buyer_city || "your city",
      negotiationUrl: `${appUrl}/delivery-negotiation?agreementId=${agreementId}`
    });

    const emailResponse = await sendEmail({
      to: [vendorEmail],
      subject: "New Delivery Inquiry - Sole-ly",
      html: html,
    });

    return new Response(JSON.stringify(emailResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error sending delivery inquiry notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
