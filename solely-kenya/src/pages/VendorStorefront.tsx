import { useState, useEffect } from "react";
import { ProductGridSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import ProductCard from "@/components/ProductCard";
import { Store, MapPin, Star, AlertTriangle, ShieldCheck, Package, Phone } from "lucide-react";

const VendorStorefront = () => {
  const { vendorId, storeLink } = useParams();
  const identifier = storeLink || vendorId;
  const navigate = useNavigate();
  
  const [vendor, setVendor] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState({ rating: 0, reviews: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (identifier) {
      fetchVendor();
    }
  }, [identifier]);

  const fetchVendor = async () => {
    setLoading(true);
    try {
      // 1. Fetch vendor profile (by store_link or id fallback)
      let profQuery = supabase.from("public_vendor_profiles").select("*");
      
      // UUID check
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier || '');
      
      if (isUUID) {
        profQuery = profQuery.eq("id", identifier);
      } else {
        profQuery = profQuery.eq("store_link", identifier);
      }

      const { data: prof, error: profError } = await profQuery.single();
        
      if (profError || !prof) throw new Error("Vendor not found");
      setVendor(prof);

      // 2. Fetch active products
      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .eq("vendor_id", prof.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
        
      if (prods) setProducts(prods);

      // 3. Fetch ratings
      // Seller ratings live in vendor_ratings; this view aggregates them.
      // (reviews has no vendor_id, so the old query here always failed.)
      const { data: ratingStats } = await supabase
        .from("vendor_rating_stats")
        .select("avg_rating, rating_count")
        .eq("vendor_id", prof.id)
        .maybeSingle();

      if (ratingStats?.rating_count) {
        setStats({ rating: Number(ratingStats.avg_rating) || 0, reviews: ratingStats.rating_count });
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
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Store not found</h1>
        <p className="text-muted-foreground">This vendor may have closed their store or the link is broken.</p>
        <button onClick={() => navigate("/shop")} className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl">
          Browse Shop
        </button>
      </div>
    );
  }

  const storeName = vendor.store_name || vendor.full_name || "Vendor Store";
  const location = vendor.vendor_city ? `${vendor.vendor_city}${vendor.vendor_county ? `, ${vendor.vendor_county}` : ''}` : null;

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <SEO 
        title={`${storeName}: Shop on Solely`}
        description={`Shop ${products.length} items from ${storeName} on Solely. Your money is held until your order arrives.`}
      />
      
      {/* Cover/Header area */}
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            <div className="h-24 w-24 md:h-32 md:w-32 bg-primary/10 text-primary border-4 border-background rounded-full flex items-center justify-center text-4xl md:text-5xl font-black shadow-sm shrink-0 overflow-hidden">
              {vendor.store_logo_url ? (
                <img src={vendor.store_logo_url} alt={storeName} className="h-full w-full object-cover" />
              ) : (
                storeName.charAt(0).toUpperCase()
              )}
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">{storeName}</h1>
                {vendor.kyc_status === 'approved' && (
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
                  <Package size={16} /> {products.length} {products.length === 1 ? "product" : "products"}
                </span>
                {/* Only when the vendor opted in by filling it on their
                    settings page - a blank one simply shows nothing. */}
                {vendor.store_phone && (
                  <a
                    href={`tel:${vendor.store_phone}`}
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Phone size={16} /> {vendor.store_phone}
                  </a>
                )}
                {stats.reviews > 0 && (
                  <span className="flex items-center gap-1.5 text-primary-strong">
                    <Star size={16} fill="currentColor" /> {stats.rating.toFixed(1)} ({stats.reviews})
                  </span>
                )}
              </div>

              {/* Only claim verification for sellers who passed KYC */}
              {vendor.kyc_status === 'approved' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a5138]/10 text-[#1a5138] text-sm font-medium rounded-lg">
                  <Store size={14} /> Verified seller
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight">All products ({products.length})</h2>
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
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price_ksh}
                image={product.images?.[0] || "/placeholder.svg"}
                brand={product.brand}
                description={product.description}
                createdAt={product.created_at}
                condition={product.condition || "new"}
                videoUrl={product.video_url}
                freeDelivery={product.free_delivery}
                category={product.category}
                vendorId={product.vendor_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorStorefront;
