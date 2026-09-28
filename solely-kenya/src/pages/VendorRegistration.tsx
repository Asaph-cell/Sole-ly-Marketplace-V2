import { useState, useEffect } from "react";
import { usePersistentState, clearDraft } from "@/hooks/usePersistentState";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/toast";
import { Check, Loader2 } from "lucide-react";

const VendorRegistration = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Level 1 only: everything else (logo, location, verification) lives in
  // /vendor/setup and can be done after the first sale.
  const [formData, setFormData] = usePersistentState("vendor-registration", {
    storeName: "",
    phone: "",
    mpesaNumber: "",
  });
  const [mpesaSameAsPhone, setMpesaSameAsPhone] = useState(true);

  useEffect(() => {
    const checkVendorStatus = async () => {
      if (!authLoading && !user) {
        toast.error("Please log in first to register as a vendor");
        navigate("/auth?redirect=/vendor/register");
        return;
      }

      if (user) {
        // Check if user is already a vendor
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "vendor");

        if (roles && roles.length > 0) {
          toast.info("You are already registered as a vendor");
          clearDraft("vendor-registration");
          navigate("/vendor/dashboard");
        }
      }
    };

    checkVendorStatus();
  }, [user, authLoading, navigate]);

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted) {
      toast.error("You must accept the Terms and Conditions to proceed");
      return;
    }

    const mpesaNumber = mpesaSameAsPhone ? formData.phone : formData.mpesaNumber;
    if (!formData.storeName.trim() || !formData.phone.trim() || !mpesaNumber.trim()) {
      toast.error("Add your store name, WhatsApp number and M-Pesa number");
      return;
    }

    if (!user) {
      toast.error("Please log in first");
      navigate("/auth?redirect=/vendor/register");
      return;
    }

    setSubmitting(true);
    try {
      // Update profile with vendor information
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          whatsapp_number: formData.phone.trim(),
          mpesa_number: mpesaNumber.trim(),
          store_name: formData.storeName.trim(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Add vendor role (uses SECURITY DEFINER function to bypass RLS)
      const { error: roleError } = await supabase.rpc('register_as_vendor');
      if (roleError) throw roleError;

      // Create IntaSend wallet for the vendor (non-blocking)
      supabase.functions.invoke('create-vendor-wallet', {
        body: { vendor_id: user.id }
      }).then((result) => {
        if (result.error) {
          console.warn('Failed to create vendor wallet:', result.error);
        } else {
          console.log('Vendor wallet created:', result.data);
        }
      }).catch((err) => {
        console.warn('Wallet creation failed (non-critical):', err);
      });

      // Send welcome email (non-blocking)
      supabase.functions.invoke('notify-vendor-welcome', {
        body: { vendorId: user.id }
      }).catch((err) => {
        console.warn('Failed to send welcome email:', err);
      });

      toast.success("You're in. List your first item.");
      clearDraft("vendor-registration");
      navigate("/vendor/list-item");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Failed to complete vendor registration");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sunken py-10 sm:py-16 px-4">
      <div className="mx-auto w-full max-w-lg">
        {/* Where this sits in the overall setup */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Step 1 of 3 · about a minute</span>
            <span className="text-muted-foreground tabular-nums">40% when done</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
            <div className="h-full w-[40%] rounded-full bg-primary/40" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            You can sell as soon as this step is done. Your logo, location and verification can wait.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-card shadow-card p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl leading-tight">Open your store</h1>
            <p className="mt-2 text-muted-foreground">Three details and you can start listing.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storeName">Store name</Label>
            <Input id="storeName" value={formData.storeName} onChange={handleInputChange("storeName")}
              placeholder="e.g. Mtaa Kicks" autoComplete="organization" required />
            <p className="text-xs text-muted-foreground">Buyers see this on your listings and store link.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Store contact number</Label>
            <Input id="phone" type="tel" inputMode="tel" value={formData.phone} onChange={handleInputChange("phone")}
              placeholder="0712 345 678" autoComplete="tel" required />
            <p className="text-xs text-muted-foreground">Buyers with an order reach you here on WhatsApp. Use a number you check often.</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={mpesaSameAsPhone} onCheckedChange={(c) => setMpesaSameAsPhone(c === true)} />
              <span className="text-sm">Use the same number for M-Pesa payouts</span>
            </label>
            {!mpesaSameAsPhone && (
              <div className="space-y-2">
                <Label htmlFor="mpesaNumber">M-Pesa number for payouts</Label>
                <Input id="mpesaNumber" type="tel" inputMode="tel" value={formData.mpesaNumber} onChange={handleInputChange("mpesaNumber")}
                  placeholder="0712 345 678" required />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Payouts go here: 94% of the product price, plus the full delivery fee. You deliver orders yourself.
            </p>
          </div>

          <div className="rounded-2xl bg-sunken p-4">
            <div className="flex items-start gap-3">
              <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} className="mt-0.5" />
              <div className="space-y-2 min-w-0">
                <Label htmlFor="terms" className="text-sm font-medium leading-snug cursor-pointer">
                  I accept the{" "}
                  <Link to="/terms" target="_blank" className="underline underline-offset-2 hover:no-underline">Terms and Conditions</Link>
                </Label>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  {[
                    "Respond to orders within 48 hours or they're cancelled automatically",
                    "You handle delivery of your orders",
                    "Solely takes 6% of the product price on each sale",
                    "Payments are held until the buyer confirms delivery",
                    "Your listings are accurate, authentic and yours to sell",
                    "You indemnify Solely Kenya against intellectual property claims from your listings",
                    "Solely is a platform and isn't liable for sellers' products",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <Check size={12} strokeWidth={2.5} className="mt-0.5 shrink-0 text-foreground/40" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={submitting || !termsAccepted} className="w-full h-12 rounded-full text-base font-semibold active:scale-[0.98]">
            {submitting ? <><Loader2 size={18} className="mr-2 animate-spin" /> Opening your store…</> : "Open my store"}
          </Button>
          <button type="button" onClick={() => navigate("/")} disabled={submitting}
            className="block w-full py-2 text-sm text-muted-foreground hover:text-foreground">
            Not now
          </button>
        </form>
      </div>
    </div>
  );
};

export default VendorRegistration;
