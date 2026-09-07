import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Store, MapPin, ShieldCheck, Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

interface VendorProduct {
  id: string;
  images: string[] | null;
  category: string | null;
}

interface VendorData {
  id: string;
  store_name: string;
  full_name: string | null;
  store_logo_url: string | null;
  store_description: string | null;
  store_link: string | null;
  vendor_city: string | null;
  vendor_county: string | null;
  kyc_status: string | null;
  products: VendorProduct[];
}

const VendorCard = ({ vendor }: { vendor: VendorData }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const allImages = vendor.products
    .flatMap((p) => p.images || [])
    .filter((img) => img !== null && img !== "/placeholder.svg");
  const displayImages = allImages.length > 0 ? allImages.slice(0, 5) : ["/placeholder.svg"];

  const categories = Array.from(new Set(vendor.products.map((p) => p.category).filter(Boolean)));
  const dealsIn = categories.length > 0
    ? categories.slice(0, 2).map((c) => c!.charAt(0).toUpperCase() + c!.slice(1)).join(", ")
    : "New store";

  useEffect(() => {
    if (displayImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % displayImages.length);
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [displayImages.length]);

  const name = vendor.store_name || vendor.full_name || "Store";
  const location = vendor.vendor_city
    ? `${vendor.vendor_city}${vendor.vendor_county ? `, ${vendor.vendor_county}` : ""}`
    : null;

  return (
    <Link
      to={`/store/${vendor.store_link || vendor.id}`}
      className="group rounded-3xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-md transition-all block relative"
    >
      <div className="relative h-32 sm:h-40 w-full overflow-hidden bg-muted">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={currentImageIndex}
            src={displayImages[currentImageIndex]}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover"
            alt={`${name} products`}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="px-4 pb-5 pt-0 relative">
        <div className="relative -mt-8 mb-2">
          <div className="w-16 h-16 rounded-2xl bg-background border-2 border-background p-0.5 shadow-sm overflow-hidden flex items-center justify-center">
            {vendor.store_logo_url ? (
              <img src={vendor.store_logo_url} alt={name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center rounded-xl text-primary font-bold text-xl">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <h3 className="font-bold text-lg text-foreground line-clamp-1 flex items-center gap-1.5">
          {name}
          {vendor.kyc_status === "approved" && (
            <ShieldCheck size={16} className="text-primary shrink-0" fill="currentColor" stroke="white" />
          )}
        </h3>

        <div className="flex items-center gap-2 mt-1 mb-3 text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            <Store size={12} /> {dealsIn}
          </span>
          {location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {location}
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed h-10">
          {vendor.store_description || `Shop the latest ${dealsIn.toLowerCase()} from ${name}. Guaranteed quality and fast delivery.`}
        </p>

        <div className="mt-4 flex items-center justify-between text-sm font-semibold text-primary group-hover:underline">
          Visit Store
          <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
};

const VendorDirectory = () => {
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      // public_vendor_profiles is a view, so PostgREST can't reliably auto-detect
      // its relationship to products for an embedded select - fetch separately
      // and join here instead.
      const { data: activeProducts } = await supabase
        .from("products")
        .select("id, vendor_id, images, category")
        .eq("status", "active");

      const productsByVendor = new Map<string, VendorProduct[]>();
      for (const p of activeProducts || []) {
        if (!p.vendor_id) continue;
        const list = productsByVendor.get(p.vendor_id) || [];
        list.push({ id: p.id, images: p.images, category: p.category });
        productsByVendor.set(p.vendor_id, list);
      }

      const { data, error } = await supabase
        .from("public_vendor_profiles")
        .select("id, store_name, full_name, store_logo_url, store_description, store_link, vendor_city, vendor_county, kyc_status")
        .order("store_name", { ascending: true });

      if (!error && data) {
        const activeVendors = data
          .filter((v) => v.store_name)
          .map((v) => ({ ...v, products: productsByVendor.get(v.id) || [] }));
        setVendors(activeVendors);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = vendors.filter((v) =>
    (v.store_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.vendor_city?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <SEO title="All Stores & Vendors | Sole-ly" description="Browse all verified sellers and stores on Sole-ly. Every purchase is protected, your money is safe until delivery." />

      {/* Header */}
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="container mx-auto px-4 py-12 md:py-16 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight mb-4">Official Stores & Vendors</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Shop directly from your favorite Instagram sellers and local brands with full Escrow protection.
          </p>

          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search for a store or city (e.g. Nairobi)"
              className="pl-10 h-12 rounded-full border-primary/20 focus-visible:ring-primary/30 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-20">
            <Store className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-bold">No stores found</h3>
            <p className="text-muted-foreground">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorDirectory;
