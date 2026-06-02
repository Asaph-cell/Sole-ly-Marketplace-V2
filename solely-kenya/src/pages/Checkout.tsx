import { FormEvent, useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { MapPin, Store } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LocationPinMap } from "@/components/LocationPinMap";

const paymentOptions = [
  { value: "intasend", label: "Pay with M-Pesa / Card (Online)", icon: "💳", description: "Secure payment via IntaSend" },
];

const Checkout = () => {
  const { items: allCartItems, removeItemsByVendor } = useCart();
  const [searchParams] = useSearchParams();
  const vendorIdParam = searchParams.get("vendorId");
  
  const items = useMemo(() => {
    if (!vendorIdParam) return allCartItems;
    return allCartItems.filter(i => i.vendorId === vendorIdParam);
  }, [allCartItems, vendorIdParam]);
  
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.priceKsh, 0), [items]);

  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const CHECKOUT_DISABLED = false;

  const [processing, setProcessing] = useState(false);
  const [paymentGateway, setPaymentGateway] = useState<string>("intasend");
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [shipping, setShipping] = useState({
    recipientName: user?.user_metadata?.full_name || "",
    phone: "",
    email: user?.email ?? "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    deliveryNotes: "",
    gps_latitude: null as number | null,
    gps_longitude: null as number | null,
    google_maps_link: null as string | null,
  });

  const shippingFee = 0; // Delivery is facilitated by the vendor directly
  const total = subtotal + shippingFee;

  useEffect(() => {
    const fetchVendorProfile = async () => {
      if (items.length > 0) {
        try {
          const productId = items[0].productId;
          const { data: product } = await supabase
            .from("products")
            .select("vendor_id")
            .eq("id", productId)
            .single();

          if (product?.vendor_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("*, vendor_county, vendor_city")
              .eq("id", product.vendor_id)
              .single();

            if (profile) {
              setVendorProfile(profile);
            }
          }
        } catch (error) {
          console.error("Error fetching vendor profile:", error);
        }
      }
    };

    fetchVendorProfile();
  }, [items]);

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("Please login to checkout");
      navigate("/auth?redirect=/checkout");
    }
  }, [authLoading, user, navigate]);

  if (CHECKOUT_DISABLED) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4 bg-muted/20">
        <div className="p-6 bg-background rounded-full shadow-sm">
          <Store strokeWidth={1.5} className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Checkout Unavailable</h1>
          <p className="max-w-md text-muted-foreground">
            We are currently upgrading our payment system to ensure a seamless experience.
            Checkout is temporarily disabled.
          </p>
        </div>
        <div className="flex gap-4">
          <Button asChild variant="outline" size="lg">
            <Link to="/shop">Continue Browsing</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">No items to checkout</h1>
        <Button asChild>
          <Link to="/shop">Browse the marketplace</Link>
        </Button>
      </div>
    );
  }

  const handleInputChange = (field: keyof typeof shipping) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setShipping((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast.error("Please log in to place an order");
      navigate("/auth?redirect=/checkout");
      return;
    }

    if (!paymentGateway) {
      toast.error("Select a payment method");
      return;
    }

    if (!shipping.recipientName || !shipping.phone || !shipping.city || !shipping.addressLine1) {
      toast.error("Please fill in all required shipping details");
      return;
    }

    setProcessing(true);
    try {
      if (!items || items.length === 0) {
        toast.error("Your cart is empty");
        setProcessing(false);
        return;
      }

      const productIds = items.map((item) => item.productId);
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, vendor_id, name, price_ksh, stock, images, brand")
        .in("id", productIds);

      if (productsError || !products || products.length !== productIds.length) {
        throw new Error("Failed to load products. Please refresh and try again.");
      }

      const vendorIds = new Set(products.map((p) => p.vendor_id));
      if (vendorIds.size > 1) {
        throw new Error("You can only checkout items from one vendor at a time.");
      }
      const vendorId = products[0].vendor_id;

      const commissionRate = 6;
      let calculatedSubtotal = 0;
      const orderItems = items.map((cartItem) => {
        const product = products.find((p) => p.id === cartItem.productId);
        if (!product) {
          throw new Error(`Product ${cartItem.name} not found`);
        }

        if (product.stock !== null && typeof product.stock === "number" && product.stock < cartItem.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Only ${product.stock} available.`);
        }

        const unitPrice = typeof product.price_ksh === "number" ? product.price_ksh : Number(product.price_ksh);
        const lineTotal = unitPrice * cartItem.quantity;
        calculatedSubtotal += lineTotal;

        return {
          product_id: product.id,
          product_name: product.name,
          product_snapshot: {
            brand: product.brand,
            images: product.images,
            price_ksh: unitPrice,
            size: cartItem.size || null,
            color: cartItem.color || null,
          },
          quantity: cartItem.quantity,
          unit_price_ksh: unitPrice,
          line_total_ksh: lineTotal,
        };
      });

      const subtotalRounded = Number(calculatedSubtotal.toFixed(2));
      const finalTotal = Number((subtotalRounded + shippingFee).toFixed(2));
      const commissionAmount = Number((subtotalRounded * (commissionRate / 100)).toFixed(2));
      const payoutAmount = Number((finalTotal - commissionAmount).toFixed(2));

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          vendor_id: vendorId,
          subtotal_ksh: subtotalRounded,
          shipping_fee_ksh: shippingFee,
          total_ksh: finalTotal,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          payout_amount: payoutAmount,
          status: "pending_payment",
        })
        .select()
        .single();

      if (orderError || !order) {
        throw new Error(orderError?.message || "Failed to create order");
      }

      const itemsToInsert = orderItems.map((item) => ({
        ...item,
        order_id: order.id,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(itemsToInsert);
      if (itemsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(itemsError.message || "Failed to save order items");
      }

      const { error: shippingError } = await supabase.from("order_shipping_details").insert({
        order_id: order.id,
        recipient_name: shipping.recipientName,
        phone: shipping.phone,
        email: shipping.email || null,
        address_line1: shipping.addressLine1,
        address_line2: shipping.addressLine2 || null,
        city: shipping.city,
        county: shipping.county || null,
        postal_code: shipping.postalCode || null,
        country: "Kenya",
        delivery_notes: shipping.deliveryNotes || null,
        delivery_type: "delivery", // Standardize to 'delivery' as vendors handle it
        gps_latitude: shipping.gps_latitude,
        gps_longitude: shipping.gps_longitude,
      });

      if (shippingError) {
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(shippingError.message || "Failed to save shipping details");
      }

      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          gateway: paymentGateway === "intasend" ? "intasend" : "mpesa",
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

      if (paymentGateway === "mpesa") {
        if (vendorIdParam) {
          removeItemsByVendor(vendorIdParam);
        } else {
          removeItemsByVendor(items[0]?.vendorId);
        }
        toast.success("Order placed! Redirecting to payment...");
        navigate(`/orders/${order.id}?payment=manual_pending`);
        return;
      }

      const { data: intasendResponse, error: intasendError } = await supabase.functions.invoke("intasend-initiate-payment", {
        body: {
          orderId: order.id,
          successUrl: `${window.location.origin}/orders/${order.id}?payment_success=true`,
          cancelUrl: `${window.location.origin}/orders/${order.id}?cancelled=true`,
        },
      });

      if (intasendError) {
        await supabase.from("payments").delete().eq("id", payment.id);
        await supabase.from("order_shipping_details").delete().eq("order_id", order.id);
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(intasendError.message || "Failed to initiate payment. Please try again.");
      }

      if (!intasendResponse?.success || !intasendResponse?.url) {
        await supabase.from("payments").delete().eq("id", payment.id);
        await supabase.from("order_shipping_details").delete().eq("order_id", order.id);
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(intasendResponse?.error || "Failed to initiate payment");
      }

      if (vendorIdParam) {
        removeItemsByVendor(vendorIdParam);
      } else {
        removeItemsByVendor(items[0]?.vendorId);
      }
      toast.success("Opening secure payment page...");
      window.location.href = intasendResponse.url;

    } catch (error) {
      console.error("Checkout error", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to place order. Please check your connection and try again.";
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {vendorProfile && (vendorProfile.store_name || vendorProfile.vendor_city || vendorProfile.vendor_address_line1) && (
            <Card className="border-primary/40">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Store size={20} strokeWidth={1.5} className=" text-primary" />
                    <h3 className="font-semibold text-lg">Vendor Location</h3>
                  </div>
                  {vendorProfile.store_name && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Store Name</p>
                      <p className="text-base font-semibold">{vendorProfile.store_name}</p>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin size={16} strokeWidth={1.5} className=" text-muted-foreground mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm">
                        {vendorProfile.vendor_address_line1 && (
                          <>{vendorProfile.vendor_address_line1}<br /></>
                        )}
                        {vendorProfile.vendor_city && (
                          <>{vendorProfile.vendor_city}{vendorProfile.vendor_county ? `, ${vendorProfile.vendor_county}` : ""}</>
                        )}
                        {!vendorProfile.vendor_address_line1 && !vendorProfile.vendor_city && (
                          <span className="text-muted-foreground italic">Location details will be provided after order placement</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Delivery Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  ℹ️ <strong>Delivery is facilitated by the vendor.</strong> You will not be charged a delivery fee during checkout. Any delivery arrangements or fees will be settled directly between you and the vendor after checkout.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Recipient name *</Label>
                  <Input id="recipientName" value={shipping.recipientName} onChange={handleInputChange("recipientName")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Delivery Phone Number *</Label>
                  <Input id="phone" value={shipping.phone} onChange={handleInputChange("phone")} required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={shipping.email} onChange={handleInputChange("email")} required />
                </div>

                <div className="space-y-4 md:col-span-2 pt-4 border-t">
                  <h3 className="font-medium text-lg">Delivery Location</h3>
                  <p className="text-sm text-muted-foreground">
                    Search for your location or drop a pin so the vendor can easily find you. (Optional but highly recommended)
                  </p>
                  
                  <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                    <AddressAutocomplete
                      value={shipping.addressLine1}
                      onAddressSelect={(address) => {
                        setShipping((prev) => ({
                          ...prev,
                          addressLine1: address.addressLine1,
                          city: address.city,
                          county: address.county,
                          gps_latitude: address.lat ? parseFloat(address.lat) : null,
                          gps_longitude: address.lon ? parseFloat(address.lon) : null,
                        }));
                      }}
                    />

                    <div className="pt-2 border-t border-border/50">
                      <p className="text-sm font-medium mb-3">Or pin your exact location:</p>
                      <LocationPinMap
                        onLocationSelect={(data) => {
                          setShipping((prev) => ({
                            ...prev,
                            gps_latitude: data.latitude,
                            gps_longitude: data.longitude,
                            google_maps_link: data.googleMapsLink,
                            addressLine1: data.addressLine1 || prev.addressLine1,
                            city: data.city || prev.city,
                            county: data.county || prev.county,
                          }));
                        }}
                        initialPosition={shipping.gps_latitude && shipping.gps_longitude ? [shipping.gps_latitude, shipping.gps_longitude] : undefined}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City / Town *</Label>
                  <Input id="city" value={shipping.city} onChange={handleInputChange("city")} placeholder="e.g. Nairobi" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="county">County *</Label>
                  <Input id="county" value={shipping.county} onChange={handleInputChange("county")} placeholder="e.g. Nairobi" required />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="addressLine1">Specific Address *</Label>
                  <Input id="addressLine1" value={shipping.addressLine1} onChange={handleInputChange("addressLine1")} placeholder="e.g. Moi Avenue, CBD" required />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="addressLine2">Apartment / Building (Optional)</Label>
                  <Input id="addressLine2" value={shipping.addressLine2} onChange={handleInputChange("addressLine2")} placeholder="e.g. Apt 4B, Jamii Tower" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Delivery notes (Optional)</Label>
                  <Input id="notes" value={shipping.deliveryNotes} onChange={handleInputChange("deliveryNotes")} placeholder="Gate code, landmark, preferred time, etc." />
                </div>
              </div>
            </CardContent>
          </Card>



          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => navigate("/cart")}>Back to cart</Button>
            <Button type="submit" disabled={processing}>{processing ? "Processing..." : "Place order"}</Button>
          </div>
        </form>

        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {items.map((item) => (
              <div key={`${item.productId}-${item.size}-${item.color}`} className="flex justify-between">
                <span>{item.quantity} × {item.name}</span>
                <span>KES {(item.quantity * item.priceKsh).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t">
              <span>Subtotal</span>
              <span>KES {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform Delivery Fee</span>
              <span>KES 0</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t">
              <span>Total due today</span>
              <span>KES {total.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your payment is held in Solely escrow until you and the vendor confirm delivery. If something goes wrong, file a dispute within 3 days of delivery.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Checkout;
