import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowRight, Store, Star, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StoreData {
  id: string;
  store_name: string;
  store_logo_url: string | null;
  store_description: string | null;
  vendor_city: string | null;
  products: {
    id: string;
    images: string[] | null;
    category: string | null;
  }[];
}

const StoreCard = ({ store }: { store: StoreData }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Get all unique product images for this store
  const allImages = store.products
    .flatMap((p) => p.images || [])
    .filter((img) => img !== null && img !== "/placeholder.svg");

  const displayImages = allImages.length > 0 ? allImages.slice(0, 5) : ["/placeholder.svg"];

  // Unique categories
  const categories = Array.from(new Set(store.products.map(p => p.category).filter(Boolean)));
  const dealsIn = categories.length > 0 
    ? categories.slice(0, 2).map(c => c!.charAt(0).toUpperCase() + c!.slice(1)).join(", ") 
    : "Various Items";

  useEffect(() => {
    if (displayImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % displayImages.length);
    }, 3000 + Math.random() * 2000); // Random stagger
    return () => clearInterval(interval);
  }, [displayImages.length]);

  return (
    <Link 
      to={`/vendor/${store.id}`}
      className="group flex-shrink-0 w-[280px] sm:w-[320px] rounded-3xl bg-background border border-border overflow-hidden shadow-sm hover:shadow-md transition-all block relative"
    >
      {/* Interchanging Product Image Header */}
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
            alt={`${store.store_name} products`}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Store Info */}
      <div className="px-4 pb-5 pt-0 relative">
        {/* Logo overlapping the header */}
        <div className="relative -mt-8 mb-2">
          <div className="w-16 h-16 rounded-2xl bg-background border-2 border-background p-0.5 shadow-sm overflow-hidden flex items-center justify-center">
            {store.store_logo_url ? (
              <img src={store.store_logo_url} alt={store.store_name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center rounded-xl text-primary font-bold text-xl">
                {store.store_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <h3 className="font-bold text-lg text-foreground line-clamp-1">{store.store_name}</h3>
        
        <div className="flex items-center gap-2 mt-1 mb-3 text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            <Store size={12} /> {dealsIn}
          </span>
          {store.vendor_city && (
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {store.vendor_city}
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed h-10">
          {store.store_description || `Shop the latest ${dealsIn.toLowerCase()} from ${store.store_name}. Guaranteed quality and fast delivery.`}
        </p>

        <div className="mt-4 flex items-center justify-between text-sm font-semibold text-primary group-hover:underline">
          Visit Store
          <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
};

export const StoreShowcase = () => {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(`
            id,
            store_name,
            store_logo_url,
            store_description,
            vendor_city,
            products!inner (
              id,
              images,
              category
            )
          `)
          .neq("store_name", "")
          .not("store_name", "is", null)
          .eq("products.status", "active")
          .limit(15);

        if (error) throw error;

        // Filter out stores with no active products
        const validStores = (data as unknown as StoreData[]).filter(
          (store) => store.products && store.products.length > 0
        );

        // Sort by number of products descending
        validStores.sort((a, b) => b.products.length - a.products.length);

        setStores(validStores);
      } catch (err) {
        console.error("Failed to fetch stores for showcase:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  if (loading || stores.length === 0) return null;

  return (
    <section className="py-8 sm:py-12 overflow-hidden bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Store className="text-primary" size={24} /> Verified Stores
          </h2>
          <Link to="/shop" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </div>

        {/* Horizontal Scroll Area */}
        <div className="-mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0">
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x">
            {stores.map((store) => (
              <div key={store.id} className="snap-start">
                <StoreCard store={store} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
