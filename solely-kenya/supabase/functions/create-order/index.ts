import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CartItem = {
  productId: string;
  quantity: number;
};

type ShippingDetails = {
  recipientName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  county?: string;
  postalCode?: string;
  country?: string;
  deliveryNotes?: string;
  shippingFeeKsh?: number;
};

type RequestPayload = {
  items: CartItem[];
  shipping: ShippingDetails;
  paymentGateway: "mpesa" | "card" | "paypal" | "flutterwave";
  paymentMetadata?: Record<string, unknown>;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  );

  try {
    const body = (await req.json()) as RequestPayload;

    if (!body.items || body.items.length === 0) {
      throw new Error("No items provided for order");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productIds = body.items.map((item) => item.productId);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, vendor_id, name, price_ksh, stock, images, brand")
      .in("id", productIds);

    if (productsError || !products || products.length !== productIds.length) {
      throw new Error("Failed to load products for checkout");
    }

    const vendorId = products[0].vendor_id;
    const uniqueVendorCount = new Set(products.map((p) => p.vendor_id)).size;
    if (uniqueVendorCount > 1) {
      throw new Error("Checkout currently supports items from one vendor at a time");
    }

    const commissionRate = 6;

    let subtotal = 0;
    const itemPayload = body.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new Error("Product not found");
      }
      if (typeof product.price_ksh !== "number") {
        throw new Error("Invalid product pricing");
      }
      if (product.stock !== null && typeof product.stock === "number" && product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const lineTotal = product.price_ksh * item.quantity;
      subtotal += lineTotal;

      return {
        order_id: "", // placeholder, set later
        product_id: product.id,
        product_name: product.name,
        product_snapshot: {
          brand: product.brand,
          images: product.images,
          price_ksh: product.price_ksh,
        },
        quantity: item.quantity,
        unit_price_ksh: product.price_ksh,
        line_total_ksh: lineTotal,
      };
    });

    const shippingFee = body.shipping.shippingFeeKsh ?? 0;
    const subtotalRounded = Number(subtotal.toFixed(2));
    const total = Number((subtotalRounded + shippingFee).toFixed(2));
    const commissionAmount = Number((subtotalRounded * (commissionRate / 100)).toFixed(2));
    const payoutAmount = Number((total - commissionAmount).toFixed(2));

    let orderId: string | null = null;
    let paymentId: string | null = null;

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          vendor_id: vendorId,
          subtotal_ksh: subtotalRounded,
          shipping_fee_ksh: shippingFee,
          total_ksh: total,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          payout_amount: payoutAmount,
          status: "pending_vendor_confirmation",
        })
        .select()
        .single();

      if (orderError || !order) {
        throw new Error(orderError?.message ?? "Failed to create order");
      }

      orderId = order.id;

      const itemsToInsert = itemPayload.map((item) => ({
        ...item,
        order_id: order.id,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(itemsToInsert);
      if (itemsError) {
        throw new Error(itemsError.message ?? "Failed to save order items");
      }

      const shipping = body.shipping;
      const { error: shippingError } = await supabase.from("order_shipping_details").insert({
        order_id: order.id,
        recipient_name: shipping.recipientName,
        phone: shipping.phone,
        email: shipping.email ?? null,
        address_line1: shipping.addressLine1,
        address_line2: shipping.addressLine2 ?? null,
        city: shipping.city,
        county: shipping.county ?? null,
        postal_code: shipping.postalCode ?? null,
        country: shipping.country ?? "Kenya",
        delivery_notes: shipping.deliveryNotes ?? null,
      });

      if (shippingError) {
        throw new Error(shippingError.message ?? "Failed to save shipping details");
      }

      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          gateway: body.paymentGateway,
          status: "pending",
          amount_ksh: total,
          currency: "KES",
          metadata: body.paymentMetadata ?? null,
        })
        .select()
        .single();

      if (paymentError || !payment) {
        throw new Error(paymentError?.message ?? "Failed to create payment record");
      }

      paymentId = payment.id;

      const { error: escrowError } = await supabase.from("escrow_transactions").insert({
        order_id: order.id,
        payment_id: payment.id,
        status: "held",
        held_amount: total,
        commission_amount: commissionAmount,
        release_amount: payoutAmount,
      });

      if (escrowError) {
        throw new Error(escrowError.message ?? "Failed to initialize escrow");
      }

      return new Response(
        JSON.stringify({
          success: true,
          orderId: order.id,
          status: order.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Order creation failed, rolling back", error);
      if (paymentId) {
        await supabase.from("payments").delete().eq("id", paymentId);
      }
      if (orderId) {
        await supabase.from("order_items").delete().eq("order_id", orderId);
        await supabase.from("order_shipping_details").delete().eq("order_id", orderId);
        await supabase.from("orders").delete().eq("id", orderId);
      }
      throw error;
    }
  } catch (error) {
    console.error("create-order error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


