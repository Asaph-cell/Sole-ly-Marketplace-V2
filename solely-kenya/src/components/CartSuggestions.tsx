import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "@/components/ProductCard";

interface CartSuggestionsProps {
  cartProductIds: string[];
}

export const CartSuggestions = ({ cartProductIds }: CartSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (cartProductIds.length === 0) return;
      setLoading(true);
      try {
        const { data: cartProducts } = await supabase
          .from("products")
          .select("category, brand")
          .in("id", cartProductIds);

        if (!cartProducts || cartProducts.length === 0) return;

        const categories = [...new Set(cartProducts.map((p) => p.category).filter(Boolean))];
        const brands = [...new Set(cartProducts.map((p) => p.brand).filter(Boolean))];

        let query = supabase
          .from("products")
          .select("id, name, price_ksh, condition, images, is_active, stock, created_at, category")
          .eq("is_active", true)
          .gt("stock", 0)
          .not("id", "in", `(${cartProductIds.join(",")})`)
          .limit(4);

        if (categories.length > 0) {
          query = query.in("category", categories);
        }

        const { data: suggestedData, error } = await query;
        
        if (error) {
          console.error("Error fetching suggestions:", error);
          return;
        }

        if (!suggestedData || suggestedData.length < 4) {
           const { data: fallback } = await supabase
            .from("products")
            .select("id, name, price_ksh, condition, images, is_active, stock, created_at, category")
            .eq("is_active", true)
            .gt("stock", 0)
            .not("id", "in", `(${cartProductIds.join(",")})`)
            .limit(4 - (suggestedData?.length || 0));
            
            setSuggestions([...(suggestedData || []), ...(fallback || [])]);
        } else {
          setSuggestions(suggestedData);
        }
      } catch (err) {
        console.error("Error in cart suggestions", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [cartProductIds]);

  if (loading || suggestions.length === 0) return null;

  return (
    <div className="mt-12 mb-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-6">You might also like</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {suggestions.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            price={product.price_ksh}
            condition={product.condition}
            image={product.images?.[0] || "/placeholder.svg"}
            createdAt={product.created_at || new Date().toISOString()}
            category={product.category}
          />
        ))}
      </div>
    </div>
  );
};
