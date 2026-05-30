import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Star, CheckCircle, AlertTriangle, Upload } from "lucide-react";

interface OrderItem {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
}

interface OrderConfirmationModalProps {
    open: boolean;
    onClose: () => void;
    orderId: string;
    vendorId: string;
    customerId: string;
    onSuccess: () => void;
    isPickup?: boolean;
}

const disputeReasons = [
    { value: "no_delivery", label: "Did not receive the item" },
    { value: "wrong_item", label: "Received wrong item" },
    { value: "damaged", label: "Item arrived damaged" },
    { value: "other", label: "Other issue" },
] as const;

export const OrderConfirmationModal = ({
    open,
    onClose,
    orderId,
    vendorId,
    customerId,
    onSuccess,
    isPickup = false,
}: OrderConfirmationModalProps) => {
    const [step, setStep] = useState<"choice" | "satisfied" | "issue">("choice");
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [feedback, setFeedback] = useState("");
    const [issueReason, setIssueReason] = useState<string>("");
    const [issueDescription, setIssueDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

    // Product ratings state
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [productRatings, setProductRatings] = useState<Record<string, number>>({});
    const [productHoverRatings, setProductHoverRatings] = useState<Record<string, number>>({});
    const [loadingItems, setLoadingItems] = useState(false);

    // Fetch order items when modal opens
    useEffect(() => {
        if (open && orderId) {
            fetchOrderItems();
        }
    }, [open, orderId]);

    const fetchOrderItems = async () => {
        setLoadingItems(true);
        try {
            const { data, error } = await supabase
                .from("order_items")
                .select("id, product_id, product_name, quantity")
                .eq("order_id", orderId);

            if (error) throw error;
            setOrderItems(data || []);
        } catch (error) {
            console.error("Failed to fetch order items:", error);
        } finally {
            setLoadingItems(false);
        }
    };

    const resetForm = () => {
        setStep("choice");
        setRating(0);
        setHoverRating(0);
        setFeedback("");
        setIssueReason("");
        setIssueDescription("");
        setEvidenceFiles([]);
        setProductRatings({});
        setProductHoverRatings({});
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    // Handle satisfied confirmation - submit reviews only (payment is released via OTP)
    const handleConfirmSatisfied = async () => {
        if (rating === 0) {
            toast.error("Please rate the vendor before confirming");
            return;
        }

        // Check if at least one product is rated
        const hasProductRating = orderItems.some(item => productRatings[item.product_id] > 0);
        if (orderItems.length > 0 && !hasProductRating) {
            toast.error("Please rate at least one product");
            return;
        }

        setSubmitting(true);
        try {
            // 1. Submit product reviews
            const productReviewPromises = orderItems
                .filter(item => productRatings[item.product_id] > 0)
                .map(item =>
                    supabase.from("reviews").insert({
                        product_id: item.product_id,
                        user_id: customerId,
                        order_id: orderId,
                        rating: productRatings[item.product_id],
                        comment: null,
                        reviewer_name: "Verified Buyer",
                    })
                );

            if (productReviewPromises.length > 0) {
                const reviewResults = await Promise.all(productReviewPromises);
                const reviewErrors = reviewResults.filter(r => r.error);
                if (reviewErrors.length > 0) {
                    console.error("Product review errors:", reviewErrors.map(r => r.error));
                    toast.warning(`Note: ${reviewErrors.length} product review(s) may not have been saved.`);
                } else {
                    console.log("Product reviews saved successfully:", reviewResults.length);
                }
            }

            // 2. Submit vendor rating
            const { error: ratingError } = await supabase.from("vendor_ratings").insert({
                order_id: orderId,
                buyer_id: customerId,
                vendor_id: vendorId,
                rating,
                review: feedback || null,
            });

            if (ratingError) {
                console.warn("Vendor rating save warning:", ratingError);
            }

            // 3. Mark buyer_confirmed on the order
            const { error: orderError } = await supabase
                .from("orders")
                .update({ buyer_confirmed: true })
                .eq("id", orderId);

            if (orderError) {
                console.warn("Order update warning:", orderError);
            }

            toast.success("Thank you for your review! Your feedback helps the community.");
            onSuccess();
            handleClose();
        } catch (error: any) {
            console.error("Review submission error:", error);
            toast.error(error.message || "Failed to submit review");
        } finally {
            setSubmitting(false);
        }
    };

    // Handle issue report - create dispute
    const handleReportIssue = async () => {
        if (!issueReason) {
            toast.error("Please select a reason for the issue");
            return;
        }
        if (!issueDescription.trim()) {
            toast.error("Please describe the issue");
            return;
        }

        setSubmitting(true);
        try {
            // 0. Upload Evidence
            const uploadedUrls: string[] = [];
            if (evidenceFiles.length > 0) {
                for (const file of evidenceFiles) {
                    const fileName = `buyer/${orderId}/${Date.now()}-${file.name}`;
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from("dispute-evidence")
                        .upload(fileName, file);

                    if (uploadError) {
                        console.warn("Upload error:", uploadError);
                        // Convert specific errors to helpful messages
                        if (uploadError.message === "The resource was not found") {
                            throw new Error("Storage bucket 'dispute-evidence' not found. Please contact support.");
                        }
                    } else if (uploadData) {
                        const { data: urlData } = supabase.storage
                            .from("dispute-evidence")
                            .getPublicUrl(uploadData.path);
                        uploadedUrls.push(urlData.publicUrl);
                    }
                }
            }

            // 1. Create dispute
            const { data: disputeData, error: disputeError } = await supabase
                .from("disputes")
                .insert({
                    order_id: orderId,
                    customer_id: customerId,
                    vendor_id: vendorId,
                    reason: issueReason as "no_delivery" | "wrong_item" | "damaged" | "other",
                    description: issueDescription,
                    status: "open",
                    buyer_evidence_urls: uploadedUrls.length > 0 ? uploadedUrls : null
                })
                .select("id")
                .single();

            if (disputeError) throw disputeError;

            // 1b. Send notifications (buyer, vendor, and support)
            if (disputeData?.id) {
                supabase.functions.invoke("notify-dispute-filed", {
                    body: { disputeId: disputeData.id }
                }).catch(e => console.error("Notification error:", e));
            }

            // 2. Update order status to disputed
            const { error: orderError } = await supabase
                .from("orders")
                .update({ status: "disputed" })
                .eq("id", orderId);

            if (orderError) throw orderError;

            // 3. Update escrow to withheld
            const { error: escrowError } = await supabase
                .from("escrow_transactions")
                .update({ status: "withheld" })
                .eq("order_id", orderId);

            if (escrowError) {
                console.warn("Escrow update warning:", escrowError);
            }

            // 4. Add vendor rating with the issue rating
            if (rating > 0) {
                const { error: reviewError } = await supabase
                    .from("vendor_ratings")
                    .insert({
                        order_id: orderId,
                        buyer_id: customerId,
                        vendor_id: vendorId,
                        rating,
                        review: `Issue reported: ${issueDescription}`,
                    });

                if (reviewError) {
                    console.warn("Review save warning:", reviewError);
                }
            }

            toast.success("Dispute filed successfully. Our team will review and contact you soon.");
            onSuccess();
            handleClose();
        } catch (error: any) {
            console.error("Dispute error:", error);
            toast.error(error.message || "Failed to file dispute");
        } finally {
            setSubmitting(false);
        }
    };

    const StarRating = () => (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    className="p-1 transition-transform hover:scale-110"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                >
                    <Star strokeWidth={1.5} className={`h-8 w-8 ${star <= (hoverRating || rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                            }`}
                    />
                </button>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">
                {rating > 0 ? `${rating}/5` : "Rate vendor"}
            </span>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {step === "choice" && "Confirm Your Order"}
                        {step === "satisfied" && "Great! Confirm Satisfaction"}
                        {step === "issue" && "Report an Issue"}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "choice" && "How was your order experience?"}
                        {step === "satisfied" && "Rate the vendor and products"}
                        {step === "issue" && "Describe the problem and we'll help resolve it"}
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: Choice */}
                {step === "choice" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                        <Button
                            variant="outline"
                            className="h-auto py-4 px-4 flex flex-col items-start gap-2 border-green-500/50 hover:bg-green-50 hover:border-green-500 whitespace-normal text-left"
                            onClick={() => setStep("satisfied")}
                        >
                            <div className="flex items-center gap-2 text-green-600 mb-1">
                                <CheckCircle size={20} strokeWidth={1.5} className=" flex-shrink-0" />
                                <span className="font-semibold">{isPickup ? "Confirm Pickup" : "Everything is Good!"}</span>
                            </div>
                            <span className="text-sm text-muted-foreground leading-snug">
                                {isPickup
                                    ? "I have collected my order and checked it."
                                    : "I received my order and I'm satisfied."}
                            </span>
                        </Button>

                        <Button
                            variant="outline"
                            className="h-auto py-4 px-4 flex flex-col items-start gap-2 border-red-500/50 hover:bg-red-50 hover:border-red-500 whitespace-normal text-left"
                            onClick={() => setStep("issue")}
                        >
                            <div className="flex items-center gap-2 text-red-600 mb-1">
                                <AlertTriangle size={20} strokeWidth={1.5} className=" flex-shrink-0" />
                                <span className="font-semibold">I Have an Issue</span>
                            </div>
                            <span className="text-sm text-muted-foreground leading-snug">
                                The order has problems. I want to report and request a refund.
                            </span>
                        </Button>
                    </div>
                )}

                {/* Step 2a: Satisfied */}
                {step === "satisfied" && (
                    <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
                        {/* Product Ratings Section */}
                        {orderItems.length > 0 && (
                            <div>
                                <Label className="text-base font-medium">Rate the Products *</Label>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Rate at least one product
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {loadingItems ? (
                                        <p className="text-sm text-muted-foreground">Loading products...</p>
                                    ) : (
                                        orderItems.map((item) => (
                                            <div key={item.id} className="border rounded-lg p-3 bg-muted/30">
                                                <p className="font-medium text-sm mb-2">
                                                    {item.product_name}
                                                    {item.quantity > 1 && <span className="text-muted-foreground ml-1">(x{item.quantity})</span>}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            className="p-0.5 transition-transform hover:scale-110"
                                                            onMouseEnter={() => setProductHoverRatings(prev => ({ ...prev, [item.product_id]: star }))}
                                                            onMouseLeave={() => setProductHoverRatings(prev => ({ ...prev, [item.product_id]: 0 }))}
                                                            onClick={() => setProductRatings(prev => ({ ...prev, [item.product_id]: star }))}
                                                        >
                                                            <Star size={20} strokeWidth={1.5} className={` ${star <= (productHoverRatings[item.product_id] || productRatings[item.product_id] || 0)
                                                                    ? "fill-yellow-400 text-yellow-400"
                                                                    : "text-gray-300"
                                                                    }`}
                                                            />
                                                        </button>
                                                    ))}
                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                        {productRatings[item.product_id] > 0 ? `${productRatings[item.product_id]}/5` : "Rate"}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Vendor Rating Section */}
                        <div className="border-t pt-4">
                            <Label className="text-base font-medium">Rate the Vendor *</Label>
                            <p className="text-sm text-muted-foreground mb-3">
                                Your rating helps other buyers make informed decisions
                            </p>
                            <StarRating />
                        </div>

                        <div>
                            <Label htmlFor="feedback">Vendor Feedback (Optional)</Label>
                            <Textarea
                                id="feedback"
                                placeholder="Share your experience with this vendor..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                rows={2}
                                className="max-w-full"
                            />
                        </div>

                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm text-green-800">
                            <strong>✅ By confirming:</strong> Your review will be submitted and the order will be marked as completed. Payment was already handled via your delivery code.
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setStep("choice")} disabled={submitting}>
                                Back
                            </Button>
                            <Button
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={handleConfirmSatisfied}
                                disabled={submitting || rating === 0 || (orderItems.length > 0 && !orderItems.some(item => productRatings[item.product_id] > 0))}
                            >
                                {submitting ? "Processing..." : "Submit Review"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2b: Issue */}
                {step === "issue" && (
                    <div className="space-y-6 py-4">
                        <div>
                            <Label>What went wrong? *</Label>
                            <Select value={issueReason} onValueChange={setIssueReason}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select the issue" />
                                </SelectTrigger>
                                <SelectContent>
                                    {disputeReasons.map((reason) => (
                                        <SelectItem key={reason.value} value={reason.value}>
                                            {reason.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="issueDesc">Describe the issue *</Label>
                            <Textarea
                                id="issueDesc"
                                placeholder="Please provide details about the problem..."
                                value={issueDescription}
                                onChange={(e) => setIssueDescription(e.target.value)}
                                rows={4}
                            />
                        </div>

                        {/* Evidence Upload Section */}
                        <div>
                            <Label htmlFor="evidence">Upload Evidence (Optional)</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                                Photos of the item, packaging, etc.
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => document.getElementById('evidence-upload')?.click()}
                                >
                                    <Upload size={16} strokeWidth={1.5} className=" mr-2" />
                                    Choose Files
                                </Button>
                                <input
                                    id="evidence-upload"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            setEvidenceFiles(Array.from(e.target.files));
                                        }
                                    }}
                                />
                                <span className="text-xs text-muted-foreground">
                                    {evidenceFiles.length > 0
                                        ? `${evidenceFiles.length} file(s) selected`
                                        : "No files selected"}
                                </span>
                            </div>
                        </div>

                        <div>
                            <Label className="text-base font-medium">Rate Your Experience</Label>
                            <p className="text-sm text-muted-foreground mb-3">
                                Your rating will be recorded even with the issue
                            </p>
                            <StarRating />
                        </div>

                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800">
                            <strong>⚠️ What happens next:</strong> Your payment will be held while our admin team reviews the dispute. We'll contact you and the vendor to resolve this.
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setStep("choice")} disabled={submitting}>
                                Back
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={handleReportIssue}
                                disabled={submitting || !issueReason || !issueDescription.trim()}
                            >
                                {submitting ? "Submitting..." : "Submit Dispute & Request Refund"}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default OrderConfirmationModal;
