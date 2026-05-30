import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import ProductCard from "@/components/ProductCard";
import { Store, MapPin, Star, AlertTriangle, ShieldCheck } from "lucide-react";

const VendorStorefront = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  
  const [vendor, setVendor] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState({ rating: 0, reviews: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vendorId) {
      fetchVendor();
    }
  }, [vendorId]);

  const fetchVendor = async () => {
    setLoading(true);
    try {
      // 1. Fetch vendor profile
      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", vendorId)
        .single();
        
      if (profError || !prof) throw new Error("Vendor not found");
      setVendor(prof);

      // 2. Fetch active products
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price_ksh, old_price_ksh, images, brand, is_discounted, category_id, vendor_id, stock, condition")
        .eq("vendor_id", vendorId)
        .eq("status", "active")
        .order("created_at", { ascending: false });
        
      if (prods) setProducts(prods);

      // 3. Fetch ratings
      const { data: reviews } = await supabase
        .from("reviews")
        .select("rating")
        .eq("vendor_id", vendorId);
        
      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        setStats({ rating: avg, reviews: reviews.length });
      }

    } catch (e) {
      console.error(e);
      setVendor(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading storefront...</p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Store Not Found</h1>
        <p className="text-muted-foreground">This vendor may have closed their store or the link is broken.</p>
        <button onClick={() => navigate("/shop")} className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl">
          Browse Marketplace
        </button>
      </div>
    );
  }

  const storeName = vendor.store_name || vendor.full_name || "Vendor Store";
  const location = vendor.vendor_city ? `${vendor.vendor_city}${vendor.vendor_county ? `, ${vendor.vendor_county}` : ''}` : null;

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <SEO 
        title={`${storeName} | Sole-ly`} 
        description={`Shop ${products.length} items from ${storeName} on Sole-ly. Escrow protected.`} 
      />
      
      {/* Cover/Header area */}
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            <div className="h-24 w-24 md:h-32 md:w-32 bg-primary/10 text-primary border-4 border-background rounded-full flex items-center justify-center text-4xl md:text-5xl font-black shadow-sm shrink-0">
              {storeName.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-2">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{storeName}</h1>
                {vendor.is_verified && (
                  <ShieldCheck className="text-primary h-6 w-6 shrink-0" fill="currentColor" stroke="white" />
                )}
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-muted-foreground">
                {location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={16} /> {location}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Package size={16} /> {products.length} Products
                </span>
                {stats.reviews > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <Star size={16} fill="currentColor" /> {stats.rating.toFixed(1)} ({stats.reviews})
                  </span>
                )}
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-emerald-100">
                <Store size={14} /> Official Partner
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight">All Products ({products.length})</h2>
        </div>
        
        {products.length === 0 ? (
          <div className="bg-background border border-border rounded-2xl p-12 text-center">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold">No products found</h3>
            <p className="text-muted-foreground mt-2">This vendor hasn't listed any items yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} viewType="grid" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorStorefront;
