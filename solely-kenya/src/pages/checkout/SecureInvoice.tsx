import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Truck, ThumbsUp, Lock, Phone, User, MapPin, Star, Zap, Info, Printer } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LocationPinMap } from "@/components/LocationPinMap";

const SecureInvoice = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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
        const { data: link, error } = await supabase
          .from("payment_links")
          .select(`*, product:product_id(*)`)
          .eq("id", id)
          .eq("is_active", true)
          .single();

        if (error || !link) {
          setLoading(false);
          return;
        }
        
        setPaymentLink(link);

        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", link.vendor_id)
          .single();
          
        setVendor(prof);

        // Fetch vendor stats
        const { data: reviews } = await supabase
          .from("reviews")
          .select("rating")
          .eq("vendor_id", link.vendor_id);
          
        if (reviews && reviews.length > 0) {
          const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
          setVendorStats({ rating: Number(avg.toFixed(1)), reviews: reviews.length });
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
          successUrl: `${window.location.origin}/track/__ORDER_ID__?payment_success=true`,
          cancelUrl: `${window.location.origin}/pay/${id}?cancelled=true`,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!paymentLink) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-slate-50 text-center">
        <Shield className="h-12 w-12 text-slate-400" />
        <h1 className="text-xl font-bold">Secure Link Not Found</h1>
        <p className="text-slate-500 text-sm">This link may be inactive, paid, or deleted.</p>
        <button onClick={() => navigate("/")} className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold">
          Go to Sole-ly Homepage
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 pb-8">
      <SEO title={`Secure Checkout: ${title}`} description={`Pay safely for ${title} via Sole-ly.`} />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white py-2 px-4 flex items-center justify-center gap-2 shadow-md sticky top-0 z-10 print:hidden">
        <Shield className="h-4 w-4" />
        <span className="text-xs font-semibold">Protected by Sole-ly Escrow</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        
        {/* Order Reference */}
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Secure Invoice</p>
            <p className="text-lg font-black text-gray-900 mt-0.5">#{paymentLink.id.split('-')[0].toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Date</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{orderDate}</p>
            </div>
            <button 
              onClick={() => window.print()} 
              className="print:hidden flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Save PDF
            </button>
          </div>
        </div>

        {/* Seller Card */}
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-100">
          <p className="text-gray-600 text-xs uppercase tracking-wide mb-3">You are buying from</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {vendor?.store_logo_url ? (
                 <img src={vendor.store_logo_url} className="h-14 w-14 rounded-full object-cover border border-border" alt="Store Logo" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white font-bold text-xl">
                  {vendor?.store_name?.[0]?.toUpperCase() || vendor?.full_name?.[0]?.toUpperCase() || "V"}
                </div>
              )}
              <div>
                <h3 className="font-bold text-gray-900">{vendor?.store_name || vendor?.full_name || "Vendor"}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < Math.floor(vendorStats.rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-600">{vendorStats.rating} ({vendorStats.reviews})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-start gap-4">
              {image ? (
                <img src={image} alt={title} className="h-16 w-16 rounded-lg object-cover bg-gray-100" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-8 w-8 text-gray-500" />
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 leading-tight">{title}</h4>
                {paymentLink.product?.category && (
                  <p className="text-sm text-gray-600 mt-1 capitalize">{paymentLink.product.category}</p>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <p className="text-xs text-gray-500">Quantity</p>
                    <p className="text-sm font-semibold text-gray-900">1x</p>
                  </div>
                </div>
              </div>
              <span className="font-bold text-lg text-amber-600 flex-shrink-0">KES {price.toLocaleString()}</span>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="p-5 bg-gray-50 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">KES {price.toLocaleString()}</span>
            </div>
            {paymentLink.delivery_fee_ksh > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="font-medium text-gray-900">KES {paymentLink.delivery_fee_ksh.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="font-bold text-gray-900">Total Due</span>
              <span className="text-3xl font-bold text-amber-600">KES {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handlePay} className="space-y-5 print:hidden">
          
          {/* Shipping & Contact Details (Compressed) */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <p className="font-bold text-gray-900 text-sm">Shipping & Contact Details</p>
            </div>
            
            <div className="space-y-3">
              {/* Row 1: Address */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Search Location *</label>
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
              <div className="bg-slate-50 p-2 rounded-md border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500 mb-2">Or pin your exact location to help the rider:</p>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Full Name *</label>
                  <div className="flex items-center px-3 py-2 bg-white rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500">
                    <User className="h-4 w-4 text-gray-400 mr-2" />
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      required
                      placeholder="John Doe"
                      className="bg-transparent w-full focus:outline-none text-gray-900 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Delivery Phone Number *</label>
                  <div className="flex items-center px-3 py-2 bg-white rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500">
                    <Phone className="h-4 w-4 text-gray-400 mr-2" />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">City *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    placeholder="Nairobi"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Email *</label>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    required
                    placeholder="john@example.com"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
              </div>

              {/* Row 5: Notes */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Special Instructions (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Leave at reception"
                  rows={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs resize-none"
                />
              </div>
            </div>
          </div>



          {/* Terms Checkbox */}
          <label className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 cursor-pointer hover:bg-blue-50 transition print:hidden">
            <input
              type="checkbox"
              required
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-5 h-5 accent-amber-500 mt-0.5 flex-shrink-0"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-900">
                I agree to the <a href="/terms" className="text-blue-600 hover:underline font-medium">Terms & Conditions</a> and <a href="/privacy" className="text-blue-600 hover:underline font-medium">Privacy Policy</a>
              </p>
              <p className="text-xs text-gray-500 mt-1">✓ Sole-ly Escrow protects both buyer and seller</p>
            </div>
          </label>

          {/* Pay Button */}
          <button
            type="submit"
            disabled={processing || !buyerName || !buyerPhone || !buyerEmail || !address || !city || !agreeTerms}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-300 disabled:to-gray-400 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg disabled:shadow-none disabled:cursor-not-allowed print:hidden"
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
            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition print:hidden border border-blue-200"
          >
            Download Invoice as PDF
          </button>

          {/* Trustmark */}
          <div className="text-center space-y-2 pb-6 print:hidden">
            <p className="text-xs text-gray-600">
              🔒 Encrypted & Secure • <span className="font-semibold">Sole-ly Escrow Protected</span>
            </p>
            <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Instant confirmation after payment</span>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};

export default SecureInvoice;
