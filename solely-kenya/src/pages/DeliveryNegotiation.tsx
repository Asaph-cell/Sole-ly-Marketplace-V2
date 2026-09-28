/**
 * DeliveryNegotiation Page
 * 
 * The core negotiation UI, buyer and vendor chat to agree on a delivery fee.
 * Shows delivery details summary + chat thread with structured proposal cards.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { ListSkeleton } from "@/components/skeletons";
// Aliased: lucide-react also exports a `User` (the avatar icon used below),
// and the bare name resolved to this type instead of the component.
import type { User as AuthUser } from "@supabase/supabase-js";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  MapPin, Send, Check, ArrowRight, Truck, Package,
  MessageCircle, Loader2, RefreshCw, User, Store,
  ShieldCheck, CreditCard,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MessageThread } from "@/components/messaging/MessageThread";
import { acceptDeliveryFee } from "@/lib/deliveryAgreement";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

interface DeliveryAgreement {
  id: string;
  product_ids: string[];
  buyer_id: string;
  vendor_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  buyer_address: string;
  buyer_city: string;
  buyer_county: string;
  buyer_gps_lat: number | null;
  buyer_gps_lng: number | null;
  buyer_delivery_notes: string;
  delivery_fee_ksh: number;
  delivery_method: string | null;
  status: string;
  proposed_by: string | null;
  agreed_at: string | null;
  conversation_id: string;
  created_at: string;
}

interface NegMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  message_type: string;
  metadata: any;
  created_at: string;
  is_read: boolean;
}

const DeliveryNegotiation = () => {
  const [searchParams] = useSearchParams();
  const agreementId = searchParams.get("agreementId");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items: cartItems, removeItemsByVendor } = useCart();

  const [agreement, setAgreement] = useState<DeliveryAgreement | null>(null);
  const [messages, setMessages] = useState<NegMessage[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [sending, setSending] = useState(false);

  // Checkout state  // Checkout state
  const [processingCheckout, setProcessingCheckout] = useState(false);

  // Load agreement + messages + products
  useEffect(() => {
    if (!agreementId || authLoading) return;
    if (!user) {
      navigate("/auth?redirect=/delivery-negotiation?agreementId=" + agreementId);
      return;
    }
    loadData();
  }, [agreementId, user, authLoading]);

  // Realtime agreement status subscription
  useEffect(() => {
    if (!agreementId) return;

    const channel = supabase
      .channel(`agreement-${agreementId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_agreements",
          filter: `id=eq.${agreementId}`,
        },
        (payload) => {
          setAgreement(payload.new as DeliveryAgreement);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [agreementId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch agreement
      const { data: agr, error: agrErr } = await supabase
        .from("delivery_agreements")
        .select("*")
        .eq("id", agreementId!)
        .single();
      if (agrErr) throw agrErr;
      setAgreement(agr);

      // Fetch products
      if (agr.product_ids?.length > 0) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, name, price_ksh, images")
          .in("id", agr.product_ids);
        setProducts(prods || []);
      }

      // Fetch vendor profile
      const { data: vendor } = await supabase
        .from("public_vendor_profiles")
        .select("id, full_name, store_name")
        .eq("id", agr.vendor_id)
        .single();
      setVendorProfile(vendor);
    } catch (err) {
      console.error("Error loading negotiation:", err);
      toast.error("Failed to load negotiation details");
    } finally {
      setLoading(false);
    }
  };

  // Accept a delivery proposal
  const handleAcceptProposal = async (fee: number, method: string | null) => {
    if (!agreement || !user) return;
    setSending(true);
    try {
      await acceptDeliveryFee(agreement, user.id, fee, method);
      toast.success(user.id === agreement.vendor_id
        ? "Delivery fee agreed. The buyer can check out now."
        : "Delivery fee agreed. You can check out now.");
    } catch (err) {
      toast.error(err, { description: "The delivery fee wasn't agreed." });
    } finally {
      setSending(false);
    }
  };

  if (authLoading || loading) {
    return <div className="container mx-auto p-4 sm:p-6"><ListSkeleton rows={5} /></div>;
  }

  if (!agreement) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold mb-2">Negotiation not found</h2>
        <p className="text-muted-foreground mb-4">This delivery agreement doesn't exist or has expired.</p>
        <Button onClick={() => navigate("/cart")}>Back to Cart</Button>
      </div>
    );
  }

  const isVendor = user?.id === agreement.vendor_id;
  const isBuyer = user?.id === agreement.buyer_id;
  const isAgreed = agreement.status === "agreed";
  const vendorName = vendorProfile?.store_name || vendorProfile?.full_name || "Vendor";
  const canPropose = !isAgreed && (isBuyer || isVendor);
  const latestProposal = agreement.proposed_by && agreement.delivery_fee_ksh > 0;
  const canAccept = latestProposal && agreement.proposed_by !== user?.id && !isAgreed;

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <MessageCircle size={24} strokeWidth={1.5} className="text-primary" />
              Delivery Negotiation
            </h1>
            <p className="text-sm text-muted-foreground">
              {isVendor ? `Buyer: ${agreement.buyer_name}` : `Vendor: ${vendorName}`}
            </p>
          </div>
          {isAgreed && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-sm px-3 py-1">
              ✅ Agreed - KES {agreement.delivery_fee_ksh.toLocaleString()}
            </Badge>
          )}
        </div>

        {/* Inline Checkout Section, replaces the old "Proceed to Checkout" button */}
        {isAgreed && isBuyer && (
          <InlineCheckout
            agreement={agreement}
            products={products}
            user={user!}
            vendorName={vendorName}
            processing={processingCheckout}
            setProcessing={setProcessingCheckout}
            removeItemsByVendor={removeItemsByVendor}
            navigate={navigate}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Delivery Details Summary */}
          <div className="lg:col-span-1 space-y-4">
            {/* Delivery Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin size={18} strokeWidth={1.5} className="text-primary" />
                  Delivery Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <User size={14} strokeWidth={1.5} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">{agreement.buyer_name}</p>
                    <p className="text-muted-foreground">{agreement.buyer_phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} strokeWidth={1.5} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p>{agreement.buyer_address}</p>
                    <p className="text-muted-foreground">{agreement.buyer_city}{agreement.buyer_county ? `, ${agreement.buyer_county}` : ""}</p>
                  </div>
                </div>
                {agreement.buyer_delivery_notes && (
                  <div className="bg-muted/50 rounded-lg p-2 text-xs text-muted-foreground">
                    📝 {agreement.buyer_delivery_notes}
                  </div>
                )}
                {agreement.buyer_gps_lat && agreement.buyer_gps_lng && (
                  <a
                    href={`https://www.google.com/maps?q=${agreement.buyer_gps_lat},${agreement.buyer_gps_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline flex items-center gap-1"
                  >
                    <MapPin size={12} strokeWidth={1.5} />
                    View on Google Maps
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Products Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package size={18} strokeWidth={1.5} className="text-primary" />
                  Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {products.map(product => {
                  // Same cart-derived numbers the checkout charges on, so
                  // this list can't disagree with the total below it.
                  const { size, color, quantity } = selectionFromCart(cartItems, product.id);
                  return (
                    <div key={product.id} className="flex gap-2 items-center">
                      <div className="w-10 h-10 rounded border overflow-hidden flex-shrink-0">
                        <img
                          src={product.images?.[0] || "/placeholder.svg"}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {quantity > 1 && <span>{quantity} × </span>}
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          KES {product.price_ksh?.toLocaleString()}
                          {size && <span> · Size {size}</span>}
                          {color && <span> · {color}</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Current Proposal Status */}
            {latestProposal && !isAgreed && (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
                <CardContent className="py-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    💰 Latest proposal: KES {agreement.delivery_fee_ksh.toLocaleString()}
                    {agreement.delivery_method && ` via ${agreement.delivery_method}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Proposed by {agreement.proposed_by === user?.id ? "you" : isVendor ? "buyer" : "vendor"}
                  </p>
                  {canAccept && (
                    <Button
                      onClick={() => handleAcceptProposal(agreement.delivery_fee_ksh, agreement.delivery_method)}
                      disabled={sending}
                      className="w-full mt-2 gap-2 bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <Check size={16} strokeWidth={1.5} />
                      Accept KES {agreement.delivery_fee_ksh.toLocaleString()}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: the shared chat thread, with the delivery fee pinned on top */}
          <div className="lg:col-span-2">
            <div className="h-[calc(100dvh-220px)] min-h-[420px] overflow-hidden rounded-3xl border border-border bg-background shadow-card">
              {agreement.conversation_id ? (
                <MessageThread conversationId={agreement.conversation_id} />
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">This negotiation has no chat yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// A delivery agreement stores product_ids and nothing else - no quantity,
// no size, no colour - so the cart is the only record of what the buyer
// actually chose. Both the itemisation shown here and the order written at
// checkout read through this, so the buyer is charged for exactly what the
// vendor is told to ship.
//
// quantity 0 means the product is no longer in the cart and the order can't
// be reconstructed; callers must treat that as "can't check out" rather
// than shipping a guess.
const selectionFromCart = (cartItems: CartItem[], productId: string) => {
    const lines = cartItems.filter((i) => i.productId === productId);
    const distinct = (values: (string | undefined)[]) => [
        ...new Set(values.filter((v): v is string => Boolean(v))),
    ];
    // One product can sit in the cart as several lines (the same shirt in M
    // and L). This path collapses them into a single order row, so sum the
    // quantities and list every pick rather than keeping the first and
    // silently dropping the rest.
    const sizes = distinct(lines.map((l) => l.size));
    const colors = distinct(lines.map((l) => l.color));
    return {
        size: sizes.length ? sizes.join(", ") : null,
        color: colors.length ? colors.join(", ") : null,
        quantity: lines.reduce((sum, l) => sum + (l.quantity || 0), 0),
    };
};

// ── InlineCheckout Component ──────────────────────────────────────────
// Shown to the buyer once the delivery fee is agreed. Creates the order
// and redirects to IntaSend without needing to go through /checkout.

const InlineCheckout = ({
  agreement,
  products,
  user,
  vendorName,
  processing,
  setProcessing,
  removeItemsByVendor,
  navigate,
}: {
  agreement: DeliveryAgreement;
  products: any[];
  user: AuthUser;
  vendorName: string;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  removeItemsByVendor: (vendorId: string) => void;
  navigate: ReturnType<typeof import("react-router-dom").useNavigate>;
}) => {
  const { data: platformSettings } = usePlatformSettings();
  const { items: cartItems } = useCart();

  // Read the cart before it is cleared for this vendor, which happens at
  // the very end of handleCheckout.
  const lines = products.map((p) => ({ product: p, ...selectionFromCart(cartItems, p.id) }));

  // Anything the buyer has since removed from their cart - or a checkout
  // resumed on another device, where the cart never existed. We can't know
  // how many they wanted, and quietly billing for one is how this path used
  // to undercharge, so block instead of guessing.
  const unresolved = lines.filter((l) => l.quantity < 1);

  const subtotal = lines.reduce((sum, l) => sum + (l.product.price_ksh || 0) * l.quantity, 0);
  const total = subtotal + agreement.delivery_fee_ksh;

  const handleCheckout = async () => {
    if (processing) return;
    if (unresolved.length > 0) {
      toast.error(
        `${unresolved.map((l) => l.product.name).join(", ")} is no longer in your cart, so we can't confirm how many you want. Add it back to your cart, then reopen this page.`
      );
      return;
    }
    setProcessing(true);
    try {
      const commissionRate = platformSettings.commissionRatePercent;
      const subtotalRounded = Number(subtotal.toFixed(2));
      const deliveryFee = Number(agreement.delivery_fee_ksh.toFixed(2));
      const finalTotal = Number((subtotalRounded + deliveryFee).toFixed(2));
      const commissionAmount = Number((subtotalRounded * (commissionRate / 100)).toFixed(2));
      const payoutAmount = Number((finalTotal - commissionAmount).toFixed(2));

      // 1. Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          vendor_id: agreement.vendor_id,
          subtotal_ksh: subtotalRounded,
          shipping_fee_ksh: deliveryFee,
          total_ksh: finalTotal,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          payout_amount: payoutAmount,
          status: "pending_payment",
        })
        .select()
        .single();

      if (orderError || !order) throw new Error(orderError?.message || "Failed to create order");

      // 2. Insert order items (one row per product, carrying the buyer's
      //    cart quantity - line totals here must add up to subtotal_ksh
      //    above, which is what the buyer is actually charged)
      const orderItems = lines.map(({ product, size, color, quantity }) => ({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        // size has no column of its own on order_items, so it rides in the
        // snapshot - which is where VendorOrders already looks for it.
        product_snapshot: { images: product.images, price_ksh: product.price_ksh, size, color },
        color,
        quantity,
        unit_price_ksh: Number(product.price_ksh),
        line_total_ksh: Number((Number(product.price_ksh) * quantity).toFixed(2)),
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(itemsError.message || "Failed to save order items");
      }

      // 3. Insert shipping details from agreement
      const { error: shippingError } = await supabase.from("order_shipping_details").insert({
        order_id: order.id,
        recipient_name: agreement.buyer_name,
        phone: agreement.buyer_phone,
        email: agreement.buyer_email || null,
        address_line1: agreement.buyer_address,
        city: agreement.buyer_city,
        county: agreement.buyer_county || null,
        country: "Kenya",
        delivery_notes: agreement.buyer_delivery_notes || null,
        delivery_type: "delivery",
        gps_latitude: agreement.buyer_gps_lat,
        gps_longitude: agreement.buyer_gps_lng,
      });

      if (shippingError) {
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(shippingError.message || "Failed to save shipping details");
      }

      // 4. Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          gateway: "intasend",
          status: "pending",
          amount_ksh: finalTotal,
          currency: "KES",
        })
        .select()
        .single();

      if (paymentError || !payment) {
        await supabase.from("order_shipping_details").delete().eq("order_id", order.id);
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(paymentError?.message || "Failed to create payment record");
      }

      // 5. Mark agreement as used
      await supabase
        .from("delivery_agreements")
        .update({ status: "used", updated_at: new Date().toISOString() })
        .eq("id", agreement.id);

      // 6. Initiate IntaSend payment
      const { data: intasendResponse, error: intasendError } = await supabase.functions.invoke(
        "intasend-initiate-payment",
        {
          body: {
            orderId: order.id,
            successUrl: `${window.location.origin}/orders/${order.id}?payment_success=true`,
            cancelUrl: `${window.location.origin}/orders/${order.id}?cancelled=true`,
          },
        }
      );

      if (intasendError || !intasendResponse?.success || !intasendResponse?.url) {
        await supabase.from("payments").delete().eq("id", payment.id);
        await supabase.from("order_shipping_details").delete().eq("order_id", order.id);
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(intasendError?.message || intasendResponse?.error || "Failed to initiate payment");
      }

      removeItemsByVendor(agreement.vendor_id);
      toast.success("Opening secure payment page...");
      window.location.href = intasendResponse.url;
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <Card className="border-2 border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-900/10 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
          <ShieldCheck size={18} strokeWidth={1.5} />
          Ready to Pay - Delivery Agreed!
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-background/80 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Products subtotal</span>
            <span className="font-medium">KES {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Delivery via {agreement.delivery_method || "negotiated"}
            </span>
            <span className="font-medium">KES {agreement.delivery_fee_ksh.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold text-base">
            <span>Total</span>
            <span className="text-green-700 dark:text-green-400">KES {total.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Delivering to <strong>{agreement.buyer_name}</strong> · {agreement.buyer_address},{" "}
          {agreement.buyer_city}
        </p>
        {unresolved.length > 0 && (
          <p className="text-xs text-destructive">
            {unresolved.map((l) => l.product.name).join(", ")} is no longer in your cart, so we
            can't confirm how many you want. Add it back to your cart, then reopen this page.
          </p>
        )}
        <Button
          className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
          onClick={handleCheckout}
          disabled={processing || unresolved.length > 0}
        >
          {processing ? (
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <CreditCard size={16} strokeWidth={1.5} />
          )}
          {processing ? "Processing..." : `Pay KES ${total.toLocaleString()} Securely`}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DeliveryNegotiation;
