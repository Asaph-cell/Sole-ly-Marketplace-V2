import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import logo from "@/assets/solely-logo.svg";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const VendorRegistration = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [formData, setFormData] = useState({
    phone: "",
    mpesaNumber: "",
    storeName: "",
    storeDescription: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
  });

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

    if (!formData.phone || !formData.mpesaNumber || !formData.storeName || !formData.addressLine1 || !formData.city) {
      toast.error("Please fill in all required fields (Phone, M-Pesa, Store Name, Location)");
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
          whatsapp_number: formData.phone,
          mpesa_number: formData.mpesaNumber,
          store_name: formData.storeName,
          store_description: formData.storeDescription || null,
          vendor_city: formData.city,
          vendor_county: formData.county,
          vendor_address_line1: formData.addressLine1,
          vendor_address_line2: formData.addressLine2 || null,
          vendor_postal_code: formData.postalCode || null,
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

      toast.success("Vendor registration successful! You can now start selling.");
      navigate("/vendor/dashboard");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Failed to complete vendor registration");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-muted/20">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <img src={logo} alt="Solely Marketplace" className="h-16 w-auto mx-auto mb-4" />
          <CardTitle className="text-2xl">Become a Vendor</CardTitle>
          <CardDescription>
            Register to start selling on Sole-ly. Complete the form below to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Alert>
              <AlertCircle size={16} strokeWidth={1.5}  />
              <AlertDescription>
                <strong>Important:</strong> Delivery is fulfilled by you directly. Buyers will pay the product price to Solely, and you will arrange delivery and collect any delivery fees directly from the buyer.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number (WhatsApp) *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="254700000000"
                  value={formData.phone}
                  onChange={handleInputChange("phone")}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be used for customer communication and order notifications
                </p>
              </div>
              <div>
                <Label htmlFor="mpesaNumber">M-Pesa Number (for Payouts) *</Label>
                <Input
                  id="mpesaNumber"
                  type="tel"
                  placeholder="254700000000"
                  value={formData.mpesaNumber}
                  onChange={handleInputChange("mpesaNumber")}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Required:</strong> This M-Pesa number will receive your sales payouts (94% of order value). Must be a valid Kenyan M-Pesa number.
                </p>
              </div>

              <div>
                <Label htmlFor="storeName">Store Name *</Label>
                <Input
                  id="storeName"
                  type="text"
                  placeholder="e.g., My Shoe Store"
                  value={formData.storeName}
                  onChange={handleInputChange("storeName")}
                  required
                />
              </div>

              <div>
                <Label htmlFor="storeDescription">Store Description</Label>
                <Textarea
                  id="storeDescription"
                  placeholder="Tell customers about your store..."
                  value={formData.storeDescription}
                  onChange={handleInputChange("storeDescription")}
                  rows={4}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Store Location *</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="city">City / Town *</Label>
                    <Input
                      id="city"
                      type="text"
                      placeholder="e.g., Nairobi"
                      value={formData.city}
                      onChange={handleInputChange("city")}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="county">County *</Label>
                    <Input
                      id="county"
                      type="text"
                      placeholder="e.g., Nairobi"
                      value={formData.county}
                      onChange={handleInputChange("county")}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="addressLine1">Specific Address *</Label>
                    <Input
                      id="addressLine1"
                      type="text"
                      placeholder="e.g., Moi Avenue, CBD"
                      value={formData.addressLine1}
                      onChange={handleInputChange("addressLine1")}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                    <Input
                      id="addressLine2"
                      type="text"
                      placeholder="Apartment, suite, unit, etc."
                      value={formData.addressLine2}
                      onChange={handleInputChange("addressLine2")}
                    />
                  </div>

                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      type="text"
                      placeholder="00100"
                      value={formData.postalCode}
                      onChange={handleInputChange("postalCode")}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    💡 Your location helps buyers know where the product is coming from.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I accept the{" "}
                    <Link to="/terms" target="_blank" className="text-primary underline hover:no-underline">
                      Terms and Conditions
                    </Link>{" "}
                    *
                  </Label>
                  <div className="text-xs text-muted-foreground mt-2">
                    By checking this box, you agree to Sole-ly's Terms and Conditions, including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li className="text-destructive font-medium">You must respond to orders within 48 hours or they will be auto-cancelled</li>
                      <li>You are responsible for all product deliveries</li>
                      <li>Sole-ly takes a 6% commission on each sale</li>
                      <li>Payments are held in escrow until delivery is confirmed</li>
                      <li>You must provide accurate product information</li>
                      <li className="font-bold text-amber-800">You certify that you have the right to sell these items and they are authentic</li>
                      <li className="font-bold text-amber-800">You agree to indemnify Sole-ly Kenya against any intellectual property claims arising from your listings</li>
                      <li>Sole-ly Kenya acts only as a platform and is not liable for vendor products</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
                className="flex-1"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={submitting || !termsAccepted}
              >
                {submitting ? "Registering..." : "Complete Registration"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorRegistration;
