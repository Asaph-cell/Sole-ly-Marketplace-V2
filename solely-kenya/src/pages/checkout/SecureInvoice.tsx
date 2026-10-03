import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { Shield, Lock, Phone, User, MapPin, Star, Zap, Printer } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LocationPinMap } from "@/components/LocationPinMap";

const SecureInvoice = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get("embed") === "true";
  const [paymentLink, setPaymentLink] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [vendorStats, setVendorStats] = useState({ rating: 4.8, reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [googleMapsLink, setGoogleMapsLink] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('mpesa');

  useEffect(() => {
    const fetchLink = async () => {
      if (!id) return;
      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        
        let query = supabase
          .from("payment_links")
          .select(`*, product:product_id(*)`)
          .eq("is_active", true);

        if (isUUID) {
          query = query.eq("id", id);
        } else {
          query = query.eq("short_code", id);
        }

        const { data: link, error } = await query.single();

        if (error || !link) {
          setLoading(false);
          return;
        }
        
        setPaymentLink(link);

        const { data: prof } = await supabase
          .from("public_vendor_profiles")
          .select("*")
          .eq("id", link.vendor_id)
          .single();
          
        setVendor(prof);

        // Fetch vendor stats
        // Seller ratings are aggregated in vendor_rating_stats (reviews has no vendor_id).
        const { data: ratingStats } = await supabase
          .from("vendor_rating_stats")
          .select("avg_rating, rating_count")
          .eq("vendor_id", link.vendor_id)
          .maybeSingle();

        if (ratingStats?.rating_count) {
          setVendorStats({ rating: Number(Number(ratingStats.avg_rating).toFixed(1)), reviews: ratingStats.rating_count });
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchLink();
  }, [id]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName || !buyerPhone || !address || !city || !agreeTerms) {
      toast.error("Please fill in all required fields and agree to the terms.");
      return;
    }
    
    setProcessing(true);
    try {
      // Ensure user has an ID if logged in (guest checkouts can have userId = null)
      let userId: string | null = null;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id) {
        userId = session.user.id;
      }

      // Invoke IntaSend edge function with checkout payload to create the order securely on the server
      const { data: intasendResponse, error: intasendError } = await supabase.functions.invoke("intasend-initiate-payment", {
        body: {
          checkoutPayload: {
            paymentLinkId: paymentLink.id,
            buyerName,
            buyerPhone,
            buyerEmail: buyerEmail || null,
            address,
            city,
            county: county || null,
            gpsLat,
            gpsLng,
            googleMapsLink,
            notes: notes || null,
            customerId: userId,
          },
          successUrl: isEmbed
            ? `${window.location.origin}/pay/${id}?embed=true&payment_success=true&order_id=__ORDER_ID__`
            : `${window.location.origin}/track/__ORDER_ID__?payment_success=true`,
          cancelUrl: isEmbed
            ? `${window.location.origin}/pay/${id}?embed=true&cancelled=true`
            : `${window.location.origin}/pay/${id}?cancelled=true`,
        },
      });

      if (intasendError || intasendResponse?.error || !intasendResponse?.url) {
        throw new Error(intasendResponse?.error || intasendError?.message || "Failed to get payment link from IntaSend");
      } 
      
      // Redirect to payment
      window.location.href = intasendResponse.url;

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred");
      setProcessing(false);
    }
  };

  // Notify parent window when returning from payment in embed mode
  useEffect(() => {
    if (isEmbed && searchParams.get("payment_success") === "true") {
      const orderId = searchParams.get("order_id") || "";
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: 'solely-payment-success', orderId },
          '*'
        );
      }
    }
  }, [isEmbed, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!paymentLink) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-muted text-center">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Secure Link Not Found</h1>
        <p className="text-muted-foreground text-sm">This link may be inactive, paid, or deleted.</p>
        <button onClick={() => isEmbed && window.parent !== window ? window.parent.postMessage({ type: 'solely-checkout-close' }, '*') : navigate("/")} className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-[hsl(45_74%_54%)] text-primary-foreground font-semibold transition-colors">
          {isEmbed ? "Close" : "Go to Solely Homepage"}
        </button>
      </div>
    );
  }

  const title = paymentLink.product ? paymentLink.product.name : paymentLink.custom_title;
  const price = paymentLink.product ? paymentLink.product.price_ksh : paymentLink.custom_price_ksh;
  const image = paymentLink.product?.images?.[0];
  const total = price + (paymentLink.delivery_fee_ksh || 0);

  const orderDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className={`min-h-screen bg-muted/40 pb-8 ${isEmbed ? 'solely-embed-mode' : ''}`}>
      <SEO title={`Secure Checkout: ${title}`} description={`Pay safely for ${title} via Solely.`} />

      {/* Header Banner, hidden in embed mode */}
      {!isEmbed && (
        <div className="bg-primary text-primary-foreground py-2 px-4 flex items-center justify-center gap-2 shadow-md sticky top-0 z-10 print:hidden">
          <Shield className="h-4 w-4" />
          <span className="text-xs font-semibold">Protected by Solely Escrow</span>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        
        {/* Order Reference */}
        <div className="bg-card rounded-lg shadow-sm p-4 border border-border flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold">Secure Invoice</p>
            <p className="text-lg font-black text-foreground mt-0.5">#{paymentLink.id.split('-')[0].toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold">Date</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{orderDate}</p>
            </div>
            <button 
              onClick={() => window.print()} 
              className="print:hidden flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted text-foreground text-xs font-semibold rounded-md transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Save PDF
            </button>
          </div>
        </div>

        {/* Seller Card */}
        <div className="bg-card rounded-lg shadow-sm p-5 border border-border">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-3">You are buying from</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {vendor?.store_logo_url ? (
                 <img src={vendor.store_logo_url} className="h-14 w-14 rounded-full object-cover border border-border" alt="Store Logo" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                  {vendor?.store_name?.[0]?.toUpperCase() || vendor?.full_name?.[0]?.toUpperCase() || "V"}
                </div>
              )}
              <div>
                <h3 className="font-bold text-foreground">{vendor?.store_name || vendor?.full_name || "Vendor"}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < Math.floor(vendorStats.rating) ? 'fill-primary-strong text-primary-strong' : 'text-muted-foreground'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{vendorStats.rating} ({vendorStats.reviews})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="bg-card rounded-lg shadow-sm overflow-hidden border border-border">
          <div className="p-5 border-b border-border">
            <div className="flex items-start gap-4">
              {image ? (
                <img src={image} alt={title} className="h-16 w-16 rounded-lg object-cover bg-muted" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-muted to-border flex items-center justify-center flex-shrink-0">
                  <Shield className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-bold text-foreground leading-tight">{title}</h4>
                {paymentLink.product?.category && (
                  <p className="text-sm text-muted-foreground mt-1 capitalize">{paymentLink.product.category}</p>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <p className="text-sm font-semibold text-foreground">1x</p>
                  </div>
                </div>
              </div>
              <span className="font-bold text-lg text-primary-strong flex-shrink-0">KES {price.toLocaleString()}</span>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="p-5 bg-muted space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground">KES {price.toLocaleString()}</span>
            </div>
            {paymentLink.delivery_fee_ksh > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="font-medium text-foreground">KES {paymentLink.delivery_fee_ksh.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 flex justify-between items-center">
              <span className="font-bold text-foreground">Total Due</span>
              <span className="text-3xl font-bold text-primary-strong">KES {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handlePay} className="space-y-5 print:hidden">
          
          {/* Shipping & Contact Details (Compressed) */}
          <div className="bg-card rounded-lg shadow-sm p-4 border border-border space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="font-bold text-foreground text-sm">Shipping & Contact Details</p>
            </div>
            
            <div className="space-y-3">
              {/* Row 1: Address */}
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Search Location *</label>
                <AddressAutocomplete
                  value={address}
                  onAddressSelect={(addr) => {
                    setAddress(addr.displayName);
                    if (addr.city) setCity(addr.city);
                    if (addr.county) setCounty(addr.county);
                    if (addr.lat) setGpsLat(parseFloat(addr.lat));
                    if (addr.lon) setGpsLng(parseFloat(addr.lon));
                  }}
                />
              </div>

              {/* Row 2: Map Pin (Slim) */}
              <div className="bg-muted p-2 rounded-md border border-border">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">Or pin your exact location to help the rider:</p>
                <LocationPinMap
                  onLocationSelect={(data) => {
                    setGpsLat(data.latitude);
                    setGpsLng(data.longitude);
                    setGoogleMapsLink(data.googleMapsLink);
                    if (data.addressLine1) setAddress(data.addressLine1);
                    if (data.city) setCity(data.city);
                    if (data.county) setCounty(data.county);
                  }}
                  initialPosition={gpsLat && gpsLng ? [gpsLat, gpsLng] : undefined}
                />
              </div>

              {/* Row 3: Name & Phone (Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Full Name *</label>
                  <div className="flex items-center px-3 min-h-[44px] bg-card rounded-md border border-border focus-within:ring-2 focus-within:ring-foreground/20">
                    <User className="h-4 w-4 text-muted-foreground mr-2" />
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      required
                      placeholder="John Doe"
                      className="bg-transparent w-full focus:outline-none text-foreground text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Delivery Phone Number *</label>
                  <div className="flex items-center px-3 min-h-[44px] bg-card rounded-md border border-border focus-within:ring-2 focus-within:ring-foreground/20">
                    <Phone className="h-4 w-4 text-muted-foreground mr-2" />
                    <input
                      type="tel"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      required
                      placeholder="07XX XXX XXX"
                      className="bg-transparent w-full focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: City & Email (Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">City *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    placeholder="Nairobi"
                    className="w-full px-3 min-h-[44px] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-foreground/20 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Email *</label>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    required
                    placeholder="john@example.com"
                    className="w-full px-3 min-h-[44px] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-foreground/20 text-xs"
                  />
                </div>
              </div>

              {/* Row 5: Notes */}
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Special Instructions (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Leave at reception"
                  rows={2}
                  className="w-full px-3 py-3 min-h-[44px] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-foreground/20 text-xs resize-none"
                />
              </div>
            </div>
          </div>



          {/* Terms Checkbox */}
          <label className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border cursor-pointer hover:bg-muted transition print:hidden">
            <input
              type="checkbox"
              required
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-5 h-5 accent-amber-500 mt-1 flex-shrink-0"
            />
            <div className="flex-1">
              <p className="text-sm text-foreground">
                I agree to the <a href="/terms" className="text-muted-foreground hover:underline font-medium">Terms & Conditions</a> and <a href="/privacy" className="text-muted-foreground hover:underline font-medium">Privacy Policy</a>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Solely Escrow protects both buyer and seller</p>
            </div>
          </label>

          {/* Pay Button */}
          <button
            type="submit"
            disabled={processing || !buyerName || !buyerPhone || !buyerEmail || !address || !city || !agreeTerms}
            className="w-full min-h-[56px] bg-primary hover:bg-[hsl(45_74%_54%)] disabled:bg-border disabled:text-muted-foreground text-primary-foreground py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-[background-color,box-shadow,transform] duration-200 ease-out-strong active:scale-[0.98] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35),0_6px_16px_-6px_hsl(40_70%_32%/0.55)] disabled:shadow-none disabled:cursor-not-allowed print:hidden"
          >
            {processing ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Lock className="h-5 w-5" />
                Complete Purchase - KES {total.toLocaleString()}
              </>
            )}
          </button>

          {/* Download Invoice Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full min-h-[56px] bg-muted hover:bg-muted text-foreground py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition print:hidden border border-border"
          >
            Download Invoice as PDF
          </button>

          {/* Trustmark */}
          <div className="text-center space-y-2 pb-6 print:hidden">
            <p className="text-xs text-muted-foreground">
              Encrypted and secure · <span className="font-semibold">Solely Escrow Protected</span>
            </p>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary-strong" />
              <span>Instant confirmation after payment</span>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};

export default SecureInvoice;
