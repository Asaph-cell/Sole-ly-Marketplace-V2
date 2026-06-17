import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type User } from "@supabase/supabase-js";
import { toast } from "sonner";

interface WishlistContextValue {
  wishlistIds: Set<string>;
  loading: boolean;
  toggle: (productId: string) => Promise<void>;
  isWished: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Subscribe to auth changes directly — no Router context needed
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch wishlist whenever user changes
  useEffect(() => {
    if (!user) {
      setWishlistIds(new Set());
      return;
    }
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", user.id);
      if (!error && data) {
        setWishlistIds(new Set(data.map((r) => r.product_id)));
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const toggle = async (productId: string) => {
    if (!user) return; // callers must guard — redirect handled in ProductCard

    const wished = wishlistIds.has(productId);

    // Optimistic update
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (wished) next.delete(productId);
      else next.add(productId);
      return next;
    });

    if (wished) {
      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);
      if (error) {
        // Revert
        setWishlistIds((prev) => { const n = new Set(prev); n.add(productId); return n; });
        toast.error("Could not remove from wishlist");
      } else {
        toast("Removed from wishlist", { duration: 1500 });
      }
    } else {
      const { error } = await supabase
        .from("wishlists")
        .insert({ user_id: user.id, product_id: productId });
      if (error) {
        // Revert
        setWishlistIds((prev) => { const n = new Set(prev); n.delete(productId); return n; });
        toast.error("Could not add to wishlist");
      } else {
        toast.success("Added to wishlist ♡", { duration: 1500 });
      }
    }
  };

  const isWished = (productId: string) => wishlistIds.has(productId);

  return (
    <WishlistContext.Provider value={{ wishlistIds, loading, toggle, isWished }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextValue => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
};
