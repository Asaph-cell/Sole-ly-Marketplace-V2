import { useState, useEffect } from "react";
import { Star, ChevronDown, ChevronUp, MessageSquareHeart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { motion } from "framer-motion";

interface ProductReviewsProps {
  productId: string;
}

export const ProductReviews = ({ productId }: ProductReviewsProps) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [displayCount, setDisplayCount] = useState(5);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReviews(data || []);

      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(avg);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star size={16} strokeWidth={1.5} key={star}
            className={` sm:h-5 sm:w-5 transition-transform ${star <= rating ? "fill-amber-400 text-amber-400 drop-shadow-sm" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-white/5 shadow-glass animate-pulse">
        <CardContent className="py-12 flex justify-center">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const visibleReviews = reviews.slice(0, displayCount);
  const hasMore = reviews.length > displayCount;

  return (
    <div className="space-y-4">
      {/* Average Rating Summary */}
      <Card className="bg-card/50 backdrop-blur-sm border-white/5 shadow-glass overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <MessageSquareHeart size={20} strokeWidth={1.5} className=" text-amber-500" /> Customer Reviews
            </CardTitle>
            {reviews.length > 0 && (
              <div className="flex items-center gap-3 bg-muted/50 rounded-full px-4 py-1.5 border border-white/5 shadow-inner">
                <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-amber-400 to-orange-600 tracking-tighter drop-shadow-sm">
                  {averageRating.toFixed(1)}
                </div>
                <div className="flex flex-col justify-center">
                  {renderStars(Math.round(averageRating))}
                  <span className="text-xs text-muted-foreground font-medium mt-0.5">
                    Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        {reviews.length === 0 && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="bg-muted p-4 rounded-full mb-3">
                <Star strokeWidth={1.5} className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-foreground font-medium mb-1">No reviews yet</p>
              <p className="text-sm text-muted-foreground">Be the first to review this product!</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Collapsible Reviews List */}
      {reviews.length > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full flex items-center justify-between h-12 rounded-xl bg-card/50 backdrop-blur-sm border-white/10 shadow-sm hover:bg-muted/50 transition-all">
              <span className="font-semibold">{isOpen ? "Hide Reviews" : "Read Customer Reviews"}</span>
              {isOpen ? <ChevronUp size={20} strokeWidth={1.5} className=" text-muted-foreground" /> : <ChevronDown size={20} strokeWidth={1.5} className=" text-muted-foreground" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            <div className="grid gap-4">
              {visibleReviews.map((review, i) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                >
                  <Card className="bg-card/40 backdrop-blur-sm border-white/5 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 sm:pt-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="font-bold text-foreground/90">{review.reviewer_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 bg-background/50 rounded-full px-2 py-1">
                          {renderStars(review.rating)}
                        </div>
                      </div>
                      {review.comment ? (
                        <p className="text-sm sm:text-base text-foreground/80 leading-relaxed bg-background/40 p-3 sm:p-4 rounded-xl border border-border/50">
                          "{review.comment}"
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                          Rating left without a written review
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDisplayCount(prev => prev + 5)}
                  className="rounded-full px-6 bg-card/50 backdrop-blur-sm border-white/10 shadow-sm"
                >
                  Load More Reviews ({reviews.length - displayCount} remaining)
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

