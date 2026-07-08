/**
 * DeliveryDetails Page
 * 
 * Inserted between Cart and Checkout in the flow.
 * Buyer enters delivery details, then either:
 * - Proceeds directly to checkout (if all items are free delivery)
 * - Opens a delivery fee negotiation chat with the vendor
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, MessageCircle, ArrowRight, Truck, Store, Package, Loader2 } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LocationPinMap } from "@/components/LocationPinMap";
import { SneakerLoader } from "@/components/ui/SneakerLoader";

const DeliveryDetails = () => {
  const { items: allCartItems } = useCart();
  const [searchParams] = useSearchParams();
  const vendorIdParam = searchParams.get("vendorId");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Filter items for this vendor
  const items = useMemo(() => {
    if (!vendorIdParam) return allCartItems;
    return allCartItems.filter(i => i.vendorId === vendorIdParam);
  }, [allCartItems, vendorIdParam]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.priceKsh, 0),
    [items]
  );

  // Delivery form state
  const [form, setForm] = useState({
    recipientName: "",
    phone: "",
    email: "",
    addressLine1: "",
    city: "",
    county: "",
    deliveryNotes: "",
    gpsLat: null as number | null,
    gpsLng: null as number | null,
  });

  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [allFreeDelivery, setAllFreeDelivery] = useState<boolean | null>(null);
  const [checkingDelivery, setCheckingDelivery] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill user info
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        recipientName: user.user_metadata?.full_name || prev.recipientName,
        email: user.email || prev.email,
        phone: user.user_metadata?.phone || prev.phone,
      }));
    }
  }, [user]);

  // Redirect if no items
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/delivery-details?vendorId=${vendorIdParam}`);
      return;
    }
    if (items.length === 0 && !authLoading) {
      navigate("/cart");
    }
  }, [items, authLoading, user, navigate, vendorIdParam]);

  // Check if all items have free delivery + fetch vendor profile
  useEffect(() => {
    const checkDeliveryStatus = async () => {
      if (items.length === 0) return;
      setCheckingDelivery(true);
      try {
        const productIds = items.map(i => i.productId);
        const { data: products, error } = await supabase
          .from("products")
          .select("id, free_delivery, vendor_id")
          .in("id", productIds);

        if (error) throw error;

        const allFree = products?.every(p => p.free_delivery === true) ?? false;
        setAllFreeDelivery(allFree);

        // Fetch vendor profile
        const vendorId = vendorIdParam || products?.[0]?.vendor_id;
        if (vendorId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, store_name, whatsapp_number")
            .eq("id", vendorId)
            .single();
          setVendorProfile(profile);
        }
      } catch (err) {
        console.error("Error checking delivery status:", err);
        toast.error("Failed to load delivery options");
      } finally {
        setCheckingDelivery(false);
      }
    };
    checkDeliveryStatus();
  }, [items, vendorIdParam]);

  // Handle free delivery → straight to checkout
  const handleProceedToCheckout = (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    // Navigate to checkout with delivery details in URL state
    navigate(`/checkout?vendorId=${vendorIdParam}`, {
      state: {
        deliveryDetails: form,
      },
    });
  };

  // Handle paid delivery → create agreement + start chat
  const handleStartNegotiation = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!user || !vendorProfile) return;

    setSubmitting(true);
    try {
      const productIds = items.map(i => i.productId);

      // 1. Create delivery agreement
      const { data: agreement, error: agreementError } = await supabase
        .from("delivery_agreements")
        .insert({
          product_ids: productIds,
          buyer_id: user.id,
          vendor_id: vendorProfile.id,
          buyer_name: form.recipientName,
          buyer_phone: form.phone,
          buyer_email: form.email,
          buyer_address: form.addressLine1,
          buyer_city: form.city,
          buyer_county: form.county,
          buyer_gps_lat: form.gpsLat,
          buyer_gps_lng: form.gpsLng,
          buyer_delivery_notes: form.deliveryNotes,
          status: "negotiating",
        })
        .select()
        .single();

      if (agreementError) throw agreementError;

      // 2. Create conversation linked to the agreement
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          buyer_id: user.id,
          vendor_id: vendorProfile.id,
          product_ids: productIds,
          delivery_agreement_id: agreement.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // 3. Update agreement with conversation link
      await supabase
        .from("delivery_agreements")
        .update({ conversation_id: conversation.id })
        .eq("id", agreement.id);

      // 4. Send system message with buyer details + product list
      const productNames = items.map(i => i.name).join(", ");
      const systemMessage = `🚚 ${form.recipientName} wants to buy ${productNames} and needs delivery to ${form.city}${form.addressLine1 ? `, ${form.addressLine1}` : ""}.\n\nPlease discuss and agree on a delivery fee.`;

      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        sender_role: "system",
        message: systemMessage,
        message_type: "system",
      });

      // Send email notification to vendor
      supabase.functions.invoke("notify-vendor-delivery-inquiry", {
        body: { agreementId: agreement.id }
      }).catch(err => console.error("Failed to invoke notification:", err));

      toast.success("Delivery inquiry sent! Chat with the vendor to agree on a delivery fee.");

      // 5. Navigate to the negotiation page
      navigate(`/delivery-negotiation?agreementId=${agreement.id}`);
    } catch (err) {
      console.error("Error starting negotiation:", err);
      toast.error("Failed to start delivery negotiation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const validateForm = (): boolean => {
    if (!form.recipientName.trim()) {
      toast.error("Please enter recipient name");
      return false;
    }
    if (!form.phone.trim()) {
      toast.error("Please enter phone number");
      return false;
    }
    if (!form.email.trim()) {
      toast.error("Please enter email address");
      return false;
    }
    if (!form.addressLine1.trim() && !form.city.trim()) {
      toast.error("Please enter your delivery address or select a location");
      return false;
    }
    return true;
  };

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (authLoading || checkingDelivery) {
    return <SneakerLoader message="Loading delivery options..." />;
  }

  if (items.length === 0) return null;

  const vendorName = vendorProfile?.store_name || vendorProfile?.full_name || "Vendor";

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Truck size={28} strokeWidth={1.5} className="text-primary" />
            Delivery Details
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your delivery information to proceed with your order from <strong>{vendorName}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Delivery Form */}
          <div className="lg:col-span-2">
            <form onSubmit={allFreeDelivery ? handleProceedToCheckout : handleStartNegotiation}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin size={20} strokeWidth={1.5} className="text-primary" />
                    Where should we deliver?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Recipient Name */}
                  <div>
                    <Label htmlFor="recipientName">Recipient Name *</Label>
                    <Input
                      id="recipientName"
                      value={form.recipientName}
                      onChange={e => updateField("recipientName", e.target.value)}
                      placeholder="Full name of recipient"
                      required
                      className="mt-1.5"
                    />
                  </div>

                  {/* Phone + Email row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={e => updateField("phone", e.target.value)}
                        placeholder="0712345678"
                        required
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={e => updateField("email", e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  {/* Address Autocomplete */}
                  <AddressAutocomplete
                    value={form.addressLine1}
                    onAddressSelect={(addr) => {
                      setForm(prev => ({
                        ...prev,
                        addressLine1: addr.addressLine1 || addr.displayName,
                        city: addr.city || prev.city,
                        county: addr.county || prev.county,
                        gpsLat: addr.lat ? parseFloat(addr.lat) : prev.gpsLat,
                        gpsLng: addr.lon ? parseFloat(addr.lon) : prev.gpsLng,
                      }));
                    }}
                    label="Delivery Address"
                    required
                  />

                  {/* City + County */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City / Town</Label>
                      <Input
                        id="city"
                        value={form.city}
                        onChange={e => updateField("city", e.target.value)}
                        placeholder="e.g. Nairobi"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="county">County</Label>
                      <Input
                        id="county"
                        value={form.county}
                        onChange={e => updateField("county", e.target.value)}
                        placeholder="e.g. Nairobi County"
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  {/* GPS Pin Map */}
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <MapPin size={16} strokeWidth={1.5} />
                      Pin Your Exact Location (Optional)
                    </Label>
                    <LocationPinMap
                      onLocationSelect={(loc) => {
                        setForm(prev => ({
                          ...prev,
                          gpsLat: loc.latitude,
                          gpsLng: loc.longitude,
                          addressLine1: loc.addressLine1 || prev.addressLine1,
                          city: loc.city || prev.city,
                          county: loc.county || prev.county,
                        }));
                      }}
                      initialPosition={
                        form.gpsLat && form.gpsLng
                          ? [form.gpsLat, form.gpsLng]
                          : undefined
                      }
                    />
                  </div>

                  {/* Delivery Notes */}
                  <div>
                    <Label htmlFor="deliveryNotes">Delivery Notes (Optional)</Label>
                    <Textarea
                      id="deliveryNotes"
                      value={form.deliveryNotes}
                      onChange={e => updateField("deliveryNotes", e.target.value)}
                      placeholder="e.g. Gate is blue, ask for security guard, call before arriving..."
                      rows={3}
                      className="mt-1.5"
                    />
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 border-t">
                    {allFreeDelivery ? (
                      <Button
                        type="submit"
                        className="w-full min-h-[52px] text-base font-semibold gap-2"
                      >
                        <ArrowRight size={20} strokeWidth={1.5} />
                        Proceed to Checkout — Free Delivery
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full min-h-[52px] text-base font-semibold gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700"
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={20} strokeWidth={1.5} className="animate-spin" />
                            Starting Chat...
                          </>
                        ) : (
                          <>
                            <MessageCircle size={20} strokeWidth={1.5} />
                            💬 Discuss Delivery Cost with Vendor
                          </>
                        )}
                      </Button>
                    )}

                    {!allFreeDelivery && (
                      <p className="text-xs text-muted-foreground text-center mt-3">
                        You'll chat with <strong>{vendorName}</strong> to agree on a delivery fee before checkout.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </form>
          </div>

          {/* Right column: Order Summary */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Store size={18} strokeWidth={1.5} className="text-primary" />
                  Order from {vendorName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map(item => (
                  <div key={`${item.productId}-${item.size}-${item.color}`} className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg border overflow-hidden flex-shrink-0">
                      <img
                        src={item.imageUrl || "/placeholder.svg"}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity}
                        {item.size && ` · Size: ${item.size}`}
                        {item.color && ` · ${item.color}`}
                      </p>
                      <p className="text-sm font-semibold">
                        KES {(item.priceKsh * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span className="font-semibold">KES {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Delivery</span>
                    {allFreeDelivery ? (
                      <Badge variant="secondary" className="text-green-600">
                        FREE
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">
                        To be agreed with vendor
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Package size={16} strokeWidth={1.5} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">How delivery works</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {allFreeDelivery
                        ? "Great news! All items in this order qualify for free delivery by the vendor."
                        : "After entering your details, you'll chat with the vendor to agree on a fair delivery fee. Once both parties agree, you can proceed to checkout and pay in one secure transaction."
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetails;
