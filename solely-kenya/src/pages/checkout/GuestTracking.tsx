import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Truck, Package, Clock, Shield, AlertTriangle } from "lucide-react";
import { SEO } from "@/components/SEO";

const GuestTracking = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const isPaymentSuccess = searchParams.get("payment_success") === "true";
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(`*, vendor:vendor_id(store_name, full_name, whatsapp_number)`)
          .eq("id", orderId)
          .single();

        if (error) throw error;
        setOrder(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    // Set up real-time subscription for order status updates
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder((prev: any) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-muted/20 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Order Not Found</h1>
        <p className="text-muted-foreground text-sm">We couldn't find the tracking details for this order.</p>
      </div>
    );
  }

  // Determine active step
  let activeStep = 0;
  if (order.status === "pending_payment") activeStep = 0;
  else if (order.status === "pending" || order.status === "accepted") activeStep = 1;
  else if (order.status === "dispatched" || order.status === "shipped") activeStep = 2;
  else if (order.status === "completed" || order.status === "delivered" || order.status === "arrived") activeStep = 3;

  const steps = [
    { icon: Clock, title: "Order Placed", desc: "Waiting for vendor to accept" },
    { icon: Package, title: "Processing", desc: "Vendor is preparing your item" },
    { icon: Truck, title: "Dispatched", desc: "Item is on the way to you" },
    { icon: CheckCircle, title: "Delivered", desc: "Enjoy your purchase!" }
  ];

  const vendorName = order.vendor?.store_name || order.vendor?.full_name || "Vendor";

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <SEO title="Order Tracking" description="Track your Sole-ly secure order." />
      
      {/* Header */}
      <div className="bg-primary text-primary-foreground text-center py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 sticky top-0 z-10 shadow-md">
        <Shield className="h-4 w-4" />
        Protected by Sole-ly Escrow
      </div>

      <div className="max-w-md mx-auto pt-8 px-4 space-y-6">
        {isPaymentSuccess && (
          <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-100 flex items-start gap-3">
            <CheckCircle className="shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-bold">Payment Successful!</p>
              <p className="text-sm mt-1">Your money is safely held in escrow. Please bookmark or save this link to track your order.</p>
            </div>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Order Tracking</h1>
          <p className="text-muted-foreground text-sm">Order #{order.id.slice(0, 8).toUpperCase()}</p>
        </div>

        {/* Status Timeline */}
        <div className="bg-background rounded-3xl p-6 shadow-sm border border-border">
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {steps.map((step, index) => {
              const isActive = index === activeStep;
              const isPast = index < activeStep;
              const Icon = step.icon;
              
              return (
                <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shrink-0 z-10 
                    ${isPast ? "bg-primary text-primary-foreground" : isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border ${isActive ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                    <h3 className={`font-bold ${isActive ? "text-primary" : isPast ? "text-foreground" : "text-muted-foreground"}`}>{step.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* The Magic Delivery OTP */}
        {order.status !== "pending_payment" && order.status !== "completed" && (
          <div className="bg-primary/10 rounded-3xl p-6 border border-primary/20 text-center">
            <h3 className="font-bold text-primary mb-2">Delivery Confirmation Code</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Give this 6-digit code to the rider or vendor when you receive your item. <strong>Do not share this code until you have inspected the item.</strong>
            </p>
            <div className="bg-background py-4 px-6 rounded-2xl inline-block shadow-sm">
              <span className="text-4xl font-black tracking-widest text-primary">
                {order.delivery_otp || "------"}
              </span>
            </div>
          </div>
        )}

        {/* Vendor Contact Info */}
        <div className="bg-background rounded-3xl p-6 shadow-sm border border-border">
          <h3 className="font-bold mb-4">Vendor Details</h3>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">{vendorName}</p>
            </div>
            {order.vendor?.whatsapp_number && (
              <a href={`tel:${order.vendor.whatsapp_number}`} className="h-10 px-4 rounded-xl bg-muted flex items-center justify-center font-semibold text-sm">
                Call Vendor
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GuestTracking;
