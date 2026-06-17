import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/contexts/WishlistContext";
import ProductCard from "@/components/ProductCard";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { Heart, ShoppingBag, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

const Wishlist = () => {
  const { user, loading: authLoading } = useAuth();
  const { wishlistIds } = useWishlist();
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch full product details for every id in the wishlist
  useEffect(() => {
    if (!user || wishlistIds.size === 0) {
      setProducts([]);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      const ids = Array.from(wishlistIds);

      const { data: productsData, error } = await supabase
        .from("products")
        .select("*")
        .in("id", ids)
        .eq("status", "active");

      if (error || !productsData) {
        setLoading(false);
        return;
      }

      // Fetch review stats
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("product_id, rating")
        .in("product_id", ids);

      const stats: Record<string, { sum: number; count: number }> = {};
      (reviewsData || []).forEach((r) => {
        if (!stats[r.product_id]) stats[r.product_id] = { sum: 0, count: 0 };
        stats[r.product_id].sum += r.rating;
        stats[r.product_id].count += 1;
      });

      setProducts(
        productsData.map((p) => {
          const s = stats[p.id];
          return {
            ...p,
            averageRating: s ? s.sum / s.count : null,
            reviewCount: s?.count ?? 0,
          };
        })
      );
      setLoading(false);
    };

    fetch();
  }, [user, wishlistIds]);

  // Re-fetch when a product is removed from wishlist (ids change)
  // The above effect already handles this since wishlistIds is a dependency.

  if (authLoading) return <SneakerLoader message="Loading..." />;

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center px-4 py-16">
        <SEO title="Wishlist | Solely" description="Sign in to view your wishlist." />
        <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center">
          <Heart size={36} strokeWidth={1.5} className="text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Your Wishlist</h1>
          <p className="text-muted-foreground max-w-xs">
            Sign in to save items you love and access them from any device.
          </p>
        </div>
        <Button
          size="lg"
          className="rounded-full gap-2"
          onClick={() => navigate(`/auth?redirect=/wishlist`)}
        >
          <LogIn size={18} strokeWidth={1.5} />
          Sign In to View Wishlist
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-10">
      <SEO
        title="My Wishlist | Solely"
        description="Items you've saved to your wishlist on Solely."
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Heart size={24} strokeWidth={1.5} className="text-rose-500 fill-rose-500" />
          <h1 className="text-2xl sm:text-3xl font-bold">My Wishlist</h1>
          {wishlistIds.size > 0 && (
            <span className="ml-1 px-2.5 py-0.5 bg-rose-100 text-rose-700 text-sm font-bold rounded-full">
              {wishlistIds.size}
            </span>
          )}
        </div>

        {loading ? (
          <SneakerLoader message="Loading your wishlist..." fullScreen={false} />
        ) : products.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center">
              <Heart size={36} strokeWidth={1.5} className="text-rose-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Nothing saved yet</h2>
              <p className="text-muted-foreground max-w-xs">
                Tap the ♡ on any product to save it here for later.
              </p>
            </div>
            <Button asChild size="lg" className="rounded-full gap-2">
              <Link to="/shop">
                <ShoppingBag size={18} strokeWidth={1.5} />
                Browse Products
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price_ksh}
                image={product.images?.[0] || "/placeholder.svg"}
                brand={product.brand}
                description={product.description}
                averageRating={product.averageRating}
                reviewCount={product.reviewCount}
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

export default Wishlist;
