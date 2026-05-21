import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Check, User, Store, CreditCard, MapPin, Save, Phone } from "lucide-react";

const VendorSettings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    whatsapp_number: "",
    mpesa_number: "",
    store_name: "",
    store_description: "",
    vendor_city: "",
    vendor_county: "",
    vendor_address_line1: "",
    vendor_address_line2: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id)
      .single();

    if (data) {
      setFormData({
        full_name: data.full_name || "",
        whatsapp_number: data.whatsapp_number || "",
        mpesa_number: data.mpesa_number || "",
        store_name: data.store_name || "",
        store_description: data.store_description || "",
        vendor_city: data.vendor_city || "",
        vendor_county: data.vendor_county || "",
        vendor_address_line1: data.vendor_address_line1 || "",
        vendor_address_line2: data.vendor_address_line2 || "",
      });

      // Set display address if location exists
      if (data.vendor_address_line1 && data.vendor_city) {
        setSelectedAddress(`${data.vendor_address_line1}, ${data.vendor_city}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate WhatsApp number format (should be in international format without +)
      if (formData.whatsapp_number) {
        const cleanNumber = formData.whatsapp_number.replace(/\D/g, "");
        if (cleanNumber.length < 10 || cleanNumber.length > 15) {
          toast.error("Please enter a valid WhatsApp number (10-15 digits)");
          setSaving(false);
          return;
        }
        // Store cleaned number
        formData.whatsapp_number = cleanNumber;
      }

      const { error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", user?.id);

      if (error) throw error;

      toast.success("Settings saved successfully!");
      setSaveSuccess(true);

      // Auto-clear success state after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <VendorNavbar />
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24">
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-muted-foreground mt-2">
                Manage your store profile, payouts, and delivery locations.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <User className="h-5 w-5 text-primary" />
                    Personal Profile
                  </CardTitle>
                  <CardDescription>
                    Your personal contact details. Not shown to customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      placeholder="e.g. John Doe"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="whatsapp_number"
                        type="tel"
                        className="pl-9"
                        placeholder="254712345678"
                        value={formData.whatsapp_number}
                        onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      International format without + (e.g., 254712345678)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Store Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Store className="h-5 w-5 text-primary" />
                    Store Details
                  </CardTitle>
                  <CardDescription>
                    This is what customers see when they view your products.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="store_name">Store Name</Label>
                    <Input
                      id="store_name"
                      placeholder="e.g. Fresh Kicks Nairobi"
                      value={formData.store_name}
                      onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store_description">Store Description</Label>
                    <Textarea
                      id="store_description"
                      placeholder="Tell customers what makes your store special..."
                      value={formData.store_description}
                      onChange={(e) => setFormData({ ...formData, store_description: e.target.value })}
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payout Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <CreditCard className="h-5 w-5 text-green-500" />
                    Payout Details
                  </CardTitle>
                  <CardDescription>
                    Where you receive your earnings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-w-md space-y-2">
                    <Label htmlFor="mpesa_number">M-Pesa Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-green-600" />
                      <Input
                        id="mpesa_number"
                        type="tel"
                        className="pl-9 border-green-200 focus-visible:ring-green-500"
                        placeholder="254712345678"
                        value={formData.mpesa_number}
                        onChange={(e) => setFormData({ ...formData, mpesa_number: e.target.value })}
                        required
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 bg-green-50 text-green-700 p-3 rounded-md">
                      <strong>90% of all your sales</strong> will be automatically disbursed to this number once the buyer confirms delivery.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Location */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <MapPin className="h-5 w-5 text-primary" />
                    Store Location
                  </CardTitle>
                  <CardDescription>
                    Used automatically for delivery fee calculations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <AddressAutocomplete
                      value={selectedAddress}
                      onAddressSelect={(address) => {
                        setSelectedAddress(address.displayName);
                        setFormData((prev) => ({
                          ...prev,
                          vendor_address_line1: address.addressLine1,
                          vendor_city: address.city,
                          vendor_county: address.county,
                        }));
                      }}
                      placeholder="Start typing your store location..."
                      label="Search Location"
                      required={false}
                    />
                    
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="vendor_address_line2">Specific Details (Optional)</Label>
                      <Input
                        id="vendor_address_line2"
                        placeholder="e.g. Shop B4, 2nd Floor, Star Mall"
                        value={formData.vendor_address_line2}
                        onChange={(e) => setFormData({ ...formData, vendor_address_line2: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Floating Action Bar */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex justify-end md:pl-64 z-10">
                <Button
                  type="submit"
                  size="lg"
                  className={`w-full sm:w-auto min-w-[200px] transition-all ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  disabled={saving}
                >
                  {saveSuccess ? (
                    <>
                      <Check className="mr-2 h-5 w-5" />
                      Saved Successfully
                    </>
                  ) : saving ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>

            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default VendorSettings;
