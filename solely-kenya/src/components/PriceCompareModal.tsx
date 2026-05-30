import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, TrendingDown, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface CompareProduct {
    id: number;
    name: string;
    price_ksh: number;
    images: string[];
    brand?: string;
    condition: string;
    sizes?: string[];
    vendor_id?: string;
    averageRating?: number | null;
    reviewCount?: number;
    store_name?: string;
    isCurrent?: boolean;
}

interface PriceCompareModalProps {
    open: boolean;
    onClose: () => void;
    currentProduct: {
        id: number;
        name: string;
        price_ksh: number;
        brand?: string;
        category?: string;
        images?: string[];
    };
}

const conditionLabel: Record<string, { label: string; color: string }> = {
    new: { label: "Mint", color: "bg-green-500" },
    like_new: { label: "Like New", color: "bg-blue-500" },
    good: { label: "Thrifted", color: "bg-purple-500" },
    fair: { label: "Thrifted", color: "bg-purple-500" },
};

export const PriceCompareModal = ({ open, onClose, currentProduct }: PriceCompareModalProps) => {
    const [listings, setListings] = useState<CompareProduct[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) fetchListings();
    }, [open]);

    const fetchListings = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from("products")
                .select("*")
                .eq("status", "active")
                .neq("id", currentProduct.id);

            if (currentProduct.brand) query = query.eq("brand", currentProduct.brand);
            else if (currentProduct.category) query = query.eq("category", currentProduct.category);

            const { data: productsData, error } = await query.limit(12);
            if (error) throw error;

            if (!productsData || productsData.length === 0) {
                setListings([]);
                setLoading(false);
                return;
            }

            // Reviews
            const productIds = productsData.map((p) => p.id);
            const { data: reviewsData } = await supabase
                .from("reviews")
                .select("product_id, rating")
                .in("product_id", productIds);

            const stats: Record<string, { sum: number; count: number }> = {};
            (reviewsData || []).forEach((r) => {
                if (!stats[r.product_id]) stats[r.product_id] = { sum: 0, count: 0 };
                stats[r.product_id].sum += r.rating;
                stats[r.product_id].count += 1;
            });

            // Store names
            const vendorIds = [...new Set(productsData.map((p) => p.vendor_id))];
            const { data: profilesData } = await supabase
                .from("profiles")
                .select("id, store_name")
                .in("id", vendorIds);

            const storeMap: Record<string, string> = {};
            (profilesData || []).forEach((p) => {
                if (p.store_name) storeMap[p.id] = p.store_name;
            });

            const processed: CompareProduct[] = productsData.map((p) => {
                const pStat = stats[p.id];
                return {
                    ...p,
                    averageRating: pStat ? pStat.sum / pStat.count : null,
                    reviewCount: pStat ? pStat.count : 0,
                    store_name: storeMap[p.vendor_id] || "Seller",
                };
            });

            processed.sort((a, b) => a.price_ksh - b.price_ksh);
            setListings(processed);
        } catch (err) {
            console.error("Error fetching compare listings:", err);
        } finally {
            setLoading(false);
        }
    };

    // Merge current product into sorted list
    const allListings: CompareProduct[] = [
        ...listings,
        {
            id: currentProduct.id,
            name: currentProduct.name,
            price_ksh: currentProduct.price_ksh,
            images: currentProduct.images ?? [],
            brand: currentProduct.brand,
            condition: "new",
            isCurrent: true,
        },
    ].sort((a, b) => a.price_ksh - b.price_ksh);

    const lowestPrice = allListings.length > 0 ? Math.min(...allListings.map((p) => p.price_ksh)) : 0;

    return (
        <Sheet open={open} onOpenChange={onClose}>
            {/* Bottom sheet on mobile, right-side panel on larger screens */}
            <SheetContent
                side="bottom"
                className="h-[85vh] flex flex-col p-0 rounded-t-3xl sm:rounded-t-3xl [&>button]:hidden"
            >
                {/* Header */}
                <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
                    <SheetTitle className="text-lg font-bold flex items-center gap-2">
                        <TrendingDown size={20} strokeWidth={1.5} className=" text-primary" />
                        Compare Prices
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground">
                        {currentProduct.brand
                            ? `Other ${currentProduct.brand} listings on Sole-ly`
                            : "Similar listings on Sole-ly"}{" "}
                        — sorted by lowest price
                    </p>
                </SheetHeader>

                {/* Scrollable list */}
                <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 strokeWidth={1.5} className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Finding best prices...</p>
                        </div>
                    ) : allListings.length <= 1 ? (
                        <div className="text-center py-16">
                            <p className="text-muted-foreground text-sm">
                                No other listings found for this brand/category.
                            </p>
                        </div>
                    ) : (
                        allListings.map((listing, index) => {
                            const cond = conditionLabel[listing.condition] || conditionLabel.new;
                            const isLowest = listing.price_ksh === lowestPrice;
                            const priceDiff = listing.isCurrent ? 0 : listing.price_ksh - currentProduct.price_ksh;

                            return (
                                <motion.div
                                    key={listing.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.04 }}
                                    className={`rounded-2xl border-2 transition-all ${listing.isCurrent
                                        ? "border-primary bg-primary/5"
                                        : isLowest
                                            ? "border-green-500/50 bg-green-500/5"
                                            : "border-border bg-card"
                                        }`}
                                >
                                    <div className="flex items-center gap-3 p-3">
                                        {/* Rank */}
                                        <span
                                            className={`text-sm font-bold w-6 text-center shrink-0 ${index === 0 ? "text-green-500" : "text-muted-foreground"
                                                }`}
                                        >
                                            #{index + 1}
                                        </span>

                                        {/* Image */}
                                        <div className="w-[72px] h-[72px] shrink-0 rounded-xl overflow-hidden bg-muted border border-border">
                                            {listing.images?.[0] ? (
                                                <img
                                                    src={listing.images[0]}
                                                    alt={listing.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-2xl">
                                                    👟
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            {/* Badges row */}
                                            <div className="flex items-center gap-1 flex-wrap mb-1">
                                                {listing.isCurrent && (
                                                    <Badge variant="default" className="text-[10px] h-4 px-1.5 py-0">
                                                        This listing
                                                    </Badge>
                                                )}
                                                {isLowest && !listing.isCurrent && (
                                                    <Badge className="text-[10px] h-4 px-1.5 py-0 bg-green-500 text-white">
                                                        Lowest
                                                    </Badge>
                                                )}
                                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${cond.color}`} />
                                                    {cond.label}
                                                </Badge>
                                            </div>

                                            {/* Name */}
                                            <p className="text-sm font-semibold leading-snug line-clamp-1">
                                                {listing.name}
                                            </p>

                                            {/* Seller */}
                                            {listing.store_name && !listing.isCurrent && (
                                                <p className="text-xs text-muted-foreground leading-none mt-0.5">
                                                    by {listing.store_name}
                                                </p>
                                            )}

                                            {/* Price row */}
                                            <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                                                <div>
                                                    <p
                                                        className={`text-sm font-bold leading-none ${isLowest
                                                            ? "text-green-600 dark:text-green-400"
                                                            : listing.isCurrent
                                                                ? "text-primary"
                                                                : ""
                                                            }`}
                                                    >
                                                        KES {listing.price_ksh.toLocaleString()}
                                                    </p>
                                                    {!listing.isCurrent && priceDiff !== 0 && (
                                                        <p
                                                            className={`text-xs mt-0.5 ${priceDiff < 0
                                                                ? "text-green-600 dark:text-green-400"
                                                                : "text-muted-foreground"
                                                                }`}
                                                        >
                                                            {priceDiff < 0
                                                                ? `${Math.abs(priceDiff).toLocaleString()} cheaper`
                                                                : `${priceDiff.toLocaleString()} more`}
                                                        </p>
                                                    )}
                                                </div>

                                                {!listing.isCurrent && (
                                                    <Button
                                                        asChild
                                                        size="sm"
                                                        variant={isLowest ? "default" : "outline"}
                                                        className="h-8 px-3 text-xs rounded-xl"
                                                        onClick={onClose}
                                                    >
                                                        <Link to={`/product/${listing.id}`}>
                                                            View <ArrowRight strokeWidth={1.5} className="h-3 w-3 ml-1" />
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Rating */}
                                            {listing.reviewCount != null && listing.reviewCount > 0 && listing.averageRating && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Star strokeWidth={1.5} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                    <span className="text-xs text-muted-foreground">
                                                        {listing.averageRating.toFixed(1)} ({listing.reviewCount})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                {!loading && allListings.length > 1 && (
                    <div className="px-5 py-3 border-t border-border shrink-0 bg-muted/30">
                        <p className="text-xs text-muted-foreground text-center">
                            {allListings.length} listings · Prices vary by condition and seller
                        </p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};

export default PriceCompareModal;
