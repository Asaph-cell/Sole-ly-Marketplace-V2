import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type OrderRecord = Tables<"orders"> & {
  order_items: Tables<"order_items">[];
};

interface OrderReviewDialogProps {
  open: boolean;
  onClose: () => void;
  order: OrderRecord;
  onReviewSubmitted?: () => void;
}

export const OrderReviewDialog = ({
  open,
  onClose,
  order,
  onReviewSubmitted,
}: OrderReviewDialogProps) => {
  const { user } = useAuth();
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [productReviews, setProductReviews] = useState<Record<string, string>>({});
  const [vendorRating, setVendorRating] = useState(0);
  const [vendorReview, setVendorReview] = useState("");
  const [hoveredProductRating, setHoveredProductRating] = useState<Record<string, number>>({});
  const [hoveredVendorRating, setHoveredVendorRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [existingReviews, setExistingReviews] = useState<{
    products: Record<string, any>;
    vendor: any | null;
  }>({ products: {}, vendor: null });

  useEffect(() => {
    if (open && order) {
      checkExistingReviews();
    }
  }, [open, order]);

  const checkExistingReviews = async () => {
    if (!user || !order) return;

    // Check for existing product reviews
    const productIds = order.order_items?.map((item) => item.product_id) || [];
    if (productIds.length > 0) {
      const { data: productReviewsData } = await supabase
        .from("reviews")
        .select("*")
        .eq("order_id", order.id)
        .in("product_id", productIds);

      if (productReviewsData) {
        const reviewsMap: Record<string, any> = {};
        productReviewsData.forEach((review) => {
          reviewsMap[review.product_id] = review;
        });
        setExistingReviews((prev) => ({ ...prev, products: reviewsMap }));
      }
    }

    // Check for existing vendor rating
    const { data: vendorRatingData } = await supabase
      .from("vendor_ratings")
      .select("*")
      .eq("order_id", order.id)
      .eq("buyer_id", user.id)
      .maybeSingle();

    if (vendorRatingData) {
      setExistingReviews((prev) => ({ ...prev, vendor: vendorRatingData }));
      setVendorRating(vendorRatingData.rating);
      setVendorReview(vendorRatingData.review || "");
    }
  };

  const handleSubmit = async () => {
    if (!user || !order) return;

    // Validate vendor rating
    if (vendorRating === 0) {
      toast.error("Please rate the vendor");
      return;
    }

    // Validate at least one product rating
    const hasProductRating = order.order_items?.some(
      (item) => productRatings[item.product_id] > 0
    );
    if (!hasProductRating) {
      toast.error("Please rate at least one product");
      return;
    }

    setSubmitting(true);
    try {
      // Submit product reviews
      const productReviewPromises = order.order_items
        ?.filter((item) => productRatings[item.product_id] > 0)
        .map(async (item) => {
          const existingReview = existingReviews.products[item.product_id];
          const reviewData = {
            product_id: item.product_id,
            user_id: user.id,
            order_id: order.id,
            rating: productRatings[item.product_id],
            comment: productReviews[item.product_id]?.trim() || null,
            reviewer_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Customer",
          };

          if (existingReview) {
            // Update existing review
            return supabase
              .from("reviews")
              .update(reviewData)
              .eq("id", existingReview.id);
          } else {
            // Create new review
            return supabase.from("reviews").insert(reviewData);
          }
        }) || [];

      // Submit vendor rating using upsert to handle both insert and update
      const vendorRatingData = {
        vendor_id: order.vendor_id,
        buyer_id: user.id,
        order_id: order.id,
        rating: vendorRating,
        review: vendorReview.trim() || null,
      };

      const vendorPromise = supabase
        .from("vendor_ratings")
        .upsert(vendorRatingData, {
          onConflict: "vendor_id,buyer_id,order_id",
        });

      const results = await Promise.all([...productReviewPromises, vendorPromise]);

      const hasError = results.some((result) => result.error);
      if (hasError) {
        toast.error("Failed to submit some reviews. Please try again.");
        return;
      }

      toast.success("Reviews submitted successfully!");
      onReviewSubmitted?.();
      onClose();
    } catch (error) {
      console.error("Error submitting reviews:", error);
      toast.error("Failed to submit reviews");
    } finally {
      setSubmitting(false);
    }
  };

  if (!order || !order.order_items) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Your Order</DialogTitle>
          <DialogDescription>
            Share your experience with the products and vendor from order #{order.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Product Reviews */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Rate Products</h3>
            {order.order_items.map((item) => {
              const existingReview = existingReviews.products[item.product_id];
              const currentRating = productRatings[item.product_id] || existingReview?.rating || 0;
              const currentReview = productReviews[item.product_id] || existingReview?.comment || "";

              return (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">{item.product_name}</Label>
                    {existingReview && (
                      <p className="text-xs text-muted-foreground">You've already reviewed this product</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Rating</Label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => {
                            setProductRatings((prev) => ({
                              ...prev,
                              [item.product_id]: star,
                            }));
                          }}
                          onMouseEnter={() => {
                            setHoveredProductRating((prev) => ({
                              ...prev,
                              [item.product_id]: star,
                            }));
                          }}
                          onMouseLeave={() => {
                            setHoveredProductRating((prev) => {
                              const newState = { ...prev };
                              delete newState[item.product_id];
                              return newState;
                            });
                          }}
                          className="transition-transform hover:scale-110"
                        >
                          <Star size={24} strokeWidth={1.5} className={` ${star <= (hoveredProductRating[item.product_id] || currentRating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                              }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`review-${item.id}`} className="text-xs mb-2 block">
                      Review (Optional)
                    </Label>
                    <Textarea
                      id={`review-${item.id}`}
                      placeholder="Share your thoughts about this product..."
                      value={currentReview}
                      onChange={(e) => {
                        setProductReviews((prev) => ({
                          ...prev,
                          [item.product_id]: e.target.value,
                        }));
                      }}
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentReview.length}/500 characters
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vendor Rating */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-lg">Rate Vendor</h3>
            <div className="border rounded-lg p-4 space-y-3">
              {existingReviews.vendor && (
                <p className="text-xs text-muted-foreground">You've already rated this vendor</p>
              )}

              <div>
                <Label className="text-xs mb-2 block">Rating *</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setVendorRating(star)}
                      onMouseEnter={() => setHoveredVendorRating(star)}
                      onMouseLeave={() => setHoveredVendorRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star size={24} strokeWidth={1.5} className={` ${star <= (hoveredVendorRating || vendorRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                          }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="vendor-review" className="text-xs mb-2 block">
                  Review (Optional)
                </Label>
                <Textarea
                  id="vendor-review"
                  placeholder="Share your experience with this vendor..."
                  value={vendorReview}
                  onChange={(e) => setVendorReview(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {vendorReview.length}/500 characters
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
              {submitting
                ? "Submitting..."
                : Object.keys(existingReviews.products).length > 0 ||
                  existingReviews.vendor
                  ? "Update Reviews"
                  : "Submit Reviews"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

