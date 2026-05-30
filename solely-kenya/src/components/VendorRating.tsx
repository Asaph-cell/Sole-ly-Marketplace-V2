import { useState, useEffect } from "react";
import { Star, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface VendorRatingProps {
  vendorId: string;
  productId?: string;
}

export const VendorRating = ({ vendorId, productId }: VendorRatingProps) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [existingRatings, setExistingRatings] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCompletedOrders();
    }
    fetchVendorRatings();
  }, [user, vendorId]);

  const fetchCompletedOrders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("status", "completed")
      .or(`buyer_email.eq.${user.email},buyer_id.eq.${user.id}`);

    if (!error && data) {
      setCompletedOrders(data);
    }
  };

  const fetchVendorRatings = async () => {
    const { data, error } = await supabase
      .from("vendor_ratings")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setExistingRatings(data);
      if (data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(avg);
      }
    }
  };

  const handleSubmitRating = async () => {
    if (!user) {
      toast.error("Please log in to rate vendors");
      return;
    }

    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }

    if (completedOrders.length === 0) {
      toast.error("You can only rate vendors you've purchased from");
      return;
    }

    // Use the first completed order
    const orderId = completedOrders[0].id;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("vendor_ratings")
        .insert({
          vendor_id: vendorId,
          buyer_id: user.id,
          order_id: orderId,
          rating,
          review: review.trim() || null,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("You've already rated this vendor for this order");
        } else {
          toast.error("Failed to submit rating");
        }
        return;
      }

      toast.success("Rating submitted successfully!");
      setRating(0);
      setReview("");
      fetchVendorRatings();
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const canRate = user && completedOrders.length > 0;

  return (
    <div className="space-y-6">
      {/* Average Rating Display */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Rating</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-bold">
              {averageRating > 0 ? averageRating.toFixed(1) : "N/A"}
            </div>
            <div>
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star size={20} strokeWidth={1.5} key={star}
                    className={` ${star <= Math.round(averageRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                      }`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {existingRatings.length} {existingRatings.length === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rating Form */}
      {canRate && (
        <Card>
          <CardHeader>
            <CardTitle>Rate This Vendor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Your Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star strokeWidth={1.5} className={`h-8 w-8 ${star <= (hoverRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                        }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Your Review (Optional)
              </label>
              <Textarea
                placeholder="Share your experience with this vendor..."
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {review.length}/500 characters
              </p>
            </div>

            <Button onClick={handleSubmitRating} disabled={submitting} className="w-full">
              {submitting ? "Submitting..." : "Submit Rating"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Collapsible Existing Reviews */}
      {existingRatings.length > 0 && (
        <Collapsible open={isReviewsOpen} onOpenChange={setIsReviewsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full flex items-center justify-between">
              <span>{isReviewsOpen ? "Hide Vendor Reviews" : "Show Vendor Reviews"}</span>
              {isReviewsOpen ? <ChevronUp size={16} strokeWidth={1.5} className=" ml-2" /> : <ChevronDown size={16} strokeWidth={1.5} className=" ml-2" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Customer Reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {existingRatings.map((rating) => (
                  <div key={rating.id} className="border-b pb-4 last:border-0">
                    <div className="flex gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star size={16} strokeWidth={1.5} key={star}
                          className={` ${star <= rating.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                            }`}
                        />
                      ))}
                    </div>
                    {rating.review && (
                      <p className="text-sm text-muted-foreground mb-2">{rating.review}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(rating.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
