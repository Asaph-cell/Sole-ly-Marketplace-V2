import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Lock, Truck, ThumbsUp, AlertTriangle, User, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEO } from "@/components/SEO";

const SecureInvoice = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paymentLink, setPaymentLink] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");

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
    if (!buyerName || !buyerPhone) {
      toast.error("Please enter your name and M-Pesa phone number");
      return;
    }
    
    setProcessing(true);
    try {
      const itemTitle = paymentLink.product ? paymentLink.product.name : paymentLink.custom_title;
      const itemPrice = paymentLink.product ? paymentLink.product.price_ksh : paymentLink.custom_price_ksh;
      const total = itemPrice + (paymentLink.delivery_fee_ksh || 0);

      // Create an order anonymously (customer_id is null)
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          vendor_id: paymentLink.vendor_id,
          payment_link_id: paymentLink.id,
          subtotal_ksh: itemPrice,
          shipping_fee_ksh: paymentLink.delivery_fee_ksh || 0,
          total_ksh: total,
          status: "pending_payment",
          commission_rate: 6,
          commission_amount: total * 0.06,
          payout_amount: total - (total * 0.06)
        })
        .select()
        .single();

      if (orderError || !order) {
        console.error("Supabase Order Error:", orderError);
        throw new Error(orderError?.message || "Failed to create secure order");
      }

      // Insert Order Items
      const { error: itemsError } = await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: paymentLink.product_id || null,
        product_name: itemTitle,
        product_snapshot: {
            price_ksh: itemPrice,
            is_custom_link: !paymentLink.product_id
        },
        quantity: 1,
        unit_price_ksh: itemPrice,
        line_total_ksh: itemPrice,
      });

      if (itemsError) throw new Error("Failed to save order items: " + itemsError.message);

      // Insert Shipping Details
      const { error: shippingError } = await supabase.from("order_shipping_details").insert({
        order_id: order.id,
        recipient_name: buyerName,
        phone: buyerPhone,
        country: "Kenya",
        city: "Kenya", // Generic fallback
        delivery_type: "delivery"
      });

      if (shippingError) throw new Error("Failed to save shipping details: " + shippingError.message);

      // Insert Payment
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          gateway: "intasend",
          status: "pending",
          amount_ksh: total,
          currency: "KES",
        })
        .select()
        .single();
        
      if (paymentError || !payment) {
        console.error("Supabase Payment Error:", paymentError);
        throw new Error(paymentError?.message || "Failed to initialize payment tracking");
      }

      // Invoke IntaSend edge function
      const { data: intasendResponse, error: intasendError } = await supabase.functions.invoke("intasend-initiate-payment", {
        body: {
          orderId: order.id,
          successUrl: `${window.location.origin}/track/${order.id}?payment_success=true`,
          cancelUrl: `${window.location.origin}/pay/${id}?cancelled=true`,
        },
      });

      if (intasendError || intasendResponse?.error || !intasendResponse?.url) {
        console.error("IntaSend Edge Function Error:", intasendError, intasendResponse);
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-muted/20 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Secure Link Not Found</h1>
        <p className="text-muted-foreground text-sm">This link may be inactive, paid, or deleted.</p>
        <button onClick={() => navigate("/")} className="px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground font-semibold">
          Go to Sole-ly Homepage
        </button>
      </div>
    );
  }

  const title = paymentLink.product ? paymentLink.product.name : paymentLink.custom_title;
  const price = paymentLink.product ? paymentLink.product.price_ksh : paymentLink.custom_price_ksh;
  const image = paymentLink.product?.images?.[0];

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <SEO title={`Secure Checkout: ${title}`} description={`Pay safely for ${title} via Sole-ly.`} />
      
      {/* Header */}
      <div className="bg-primary text-primary-foreground text-center py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 sticky top-0 z-10 shadow-md">
        <Shield className="h-4 w-4" />
        Protected by Sole-ly Escrow
      </div>

      <div className="max-w-md mx-auto pt-8 px-4 space-y-6">
        {/* Vendor Info */}
        <div className="text-center space-y-2">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-2xl font-bold mx-auto">
            {vendor?.full_name?.[0]?.toUpperCase() || "V"}
          </div>
          <p className="text-sm text-muted-foreground">You are buying from</p>
          <h2 className="text-xl font-bold">{vendor?.store_name || vendor?.full_name || "Vendor"}</h2>
        </div>

        {/* Invoice Card */}
        <div className="bg-background rounded-3xl p-6 shadow-sm border border-border">
          <div className="flex gap-4 items-start pb-4 border-b border-border">
            {image ? (
              <img src={image} alt={title} className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="h-16 w-16 bg-muted rounded-xl flex items-center justify-center">
                <Shield className="text-muted-foreground/30 h-8 w-8" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-lg leading-tight">{title}</h3>
              <p className="text-2xl font-black text-primary mt-1">KES {price.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="space-y-2 pt-4 text-sm font-medium">
            <div className="flex justify-between text-muted-foreground">
              <span>Item Price</span>
              <span>KES {price.toLocaleString()}</span>
            </div>
            {paymentLink.delivery_fee_ksh > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery Fee</span>
                <span>KES {paymentLink.delivery_fee_ksh.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
              <span>Total Due</span>
              <span>KES {(price + (paymentLink.delivery_fee_ksh || 0)).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Trust Points */}
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
          <p className="text-emerald-800 text-sm font-bold flex items-center gap-2 mb-3">
            <Lock size={16} /> How your money is protected
          </p>
          <div className="space-y-3">
            <div className="flex gap-3 text-emerald-700">
              <Shield size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs">Your payment goes into a secure vault, not to the seller.</p>
            </div>
            <div className="flex gap-3 text-emerald-700">
              <Truck size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs">The seller ships the item to you.</p>
            </div>
            <div className="flex gap-3 text-emerald-700">
              <ThumbsUp size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs">When you receive it, you click "Confirm Delivery" to release the funds to the seller.</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handlePay} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Your Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                className="pl-10 h-12 rounded-xl" 
                placeholder="John Doe" 
                value={buyerName} 
                onChange={(e) => setBuyerName(e.target.value)} 
                required 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>M-Pesa Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                className="pl-10 h-12 rounded-xl" 
                placeholder="07XX XXX XXX" 
                value={buyerPhone} 
                onChange={(e) => setBuyerPhone(e.target.value)} 
                required 
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg mt-6"
          >
            {processing ? (
               <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
               <><Lock size={20} /> Pay Securely</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SecureInvoice;
