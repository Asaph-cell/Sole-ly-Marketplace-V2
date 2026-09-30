import { useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/skeletons";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Check } from "lucide-react";
import { motion } from "framer-motion";
import { SEO } from "@/components/SEO";

interface Rating {
    id: string;
    rating: number;
    review: string | null;
    created_at: string;
    order_id: string;
}

const VendorRatings = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [ratings, setRatings] = useState<Rating[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [stats, setStats] = useState({
        average: 0,
        total: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });

    useEffect(() => {
        if (!loading && !user) {
            navigate("/auth");
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        if (user) {
            loadRatings();
        }
    }, [user]);

    const loadRatings = async () => {
        setLoadingData(true);
        try {
            // Fetch ratings WITHOUT buyer details (anonymous)
            const { data, error } = await supabase
                .from("vendor_ratings")
                .select("id, rating, review, created_at, order_id")
                .eq("vendor_id", user?.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            setRatings(data || []);

            // Calculate stats
            if (data && data.length > 0) {
                const total = data.length;
                const sum = data.reduce((acc, r) => acc + r.rating, 0);
                const average = sum / total;

                const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
                data.forEach((r) => {
                    if (r.rating >= 1 && r.rating <= 5) {
                        breakdown[r.rating as keyof typeof breakdown]++;
                    }
                });

                setStats({ average: Number(average.toFixed(1)), total, breakdown });
            }
        } catch (error) {
            console.error("Error loading ratings:", error);
        } finally {
            setLoadingData(false);
        }
    };

    const renderStars = (rating: number) => {
        return (
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star size={16} strokeWidth={1.5} key={star}
                        className={` sm:h-5 sm:w-5 transition-transform ${star <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"
                            }`}
                    />
                ))}
            </div>
        );
    };

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <SEO title="My ratings" description="See what buyers say about your store and your average rating on Solely." />
            <VendorNavbar />
            
            <div className="flex flex-1 overflow-hidden">
                <VendorSidebar />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-muted/10 relative">

                    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="font-display text-3xl leading-tight sm:text-4xl">
                                    Ratings
                                </h1>
                            </div>
                        </div>

                        {loadingData ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-muted-foreground">Loading your ratings...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                                {/* Left Column: Stats & Breakdown */}
                                <div className="lg:col-span-1 space-y-6">
                                    {/* Overall Rating Card */}
                                    <motion.div>
                                        <Card className="bg-card overflow-hidden relative">
                                                                                        <CardHeader className="pb-2">
                                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                                    Overall rating
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-col items-center text-center py-4">
                                                    <div className="font-display text-6xl leading-none tabular-nums text-foreground mb-4">
                                                        {stats.average > 0 ? stats.average : "-"}
                                                    </div>
                                                    <div className="flex justify-center mb-3">
                                                        {renderStars(Math.round(stats.average))}
                                                    </div>
                                                    <Badge variant="muted" className="text-xs">
                                                        Based on {stats.total} {stats.total === 1 ? "review" : "reviews"}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>

                                    {/* Rating Breakdown */}
                                    <motion.div>
                                        <Card className="bg-card">
                                            <CardHeader>
                                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                                    Breakdown
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {[5, 4, 3, 2, 1].map((star) => {
                                                    const count = stats.breakdown[star as keyof typeof stats.breakdown];
                                                    const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                                                    return (
                                                        <div key={star} className="flex items-center gap-3 group">
                                                            <div className="flex items-center gap-1 w-8 shrink-0">
                                                                <span className="text-sm font-medium">{star}</span>
                                                                <Star strokeWidth={1.5} className="h-3 w-3 text-primary fill-primary" />
                                                            </div>
                                                            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${percentage}%` }}
                                                                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                                                    className={`h-full rounded-full ${
                                                                        star >= 4 ? 'bg-success' :
                                                                        star === 3 ? 'bg-primary' : 'bg-destructive'
                                                                    }`}
                                                                />
                                                            </div>
                                                            <span className="text-sm font-medium text-muted-foreground w-8 text-right group-hover:text-foreground transition-colors">
                                                                {count}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </CardContent>
                                        </Card>
                                    </motion.div>

                                    {/* Tips Card */}
                                    <motion.div>
                                        <Card className="bg-primary-soft border-primary/20 shadow-none relative overflow-hidden">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-lg font-semibold text-primary-strong">
                                                    Tips for 5 stars
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ul className="space-y-2.5 text-sm font-medium text-foreground/80">
                                                    <li className="flex items-start gap-2">
                                                        <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-success" /> Respond to orders quickly
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-success" /> Deliver items on time
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-success" /> Use accurate descriptions
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-success" /> Package items securely
                                                    </li>
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                </div>

                                {/* Right Column: Reviews List */}
                                <div className="lg:col-span-2">
                                    <motion.div>
                                        <Card className="bg-card h-full">
                                            <CardHeader className="border-b border-border/50 pb-4">
                                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                                    Customer reviews
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                {ratings.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                                                        <div className="bg-muted/50 p-6 rounded-full mb-4">
                                                            <Star strokeWidth={1.5} className="h-10 w-10 text-muted-foreground/40" />
                                                        </div>
                                                        <h3 className="text-xl font-semibold mb-2">No reviews yet</h3>
                                                        <p className="text-muted-foreground max-w-sm">
                                                            Reviews will appear here as soon as customers rate their completed orders.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-border/50">
                                                        {ratings.map((rating, i) => (
                                                            <motion.div
                                                                key={rating.id}
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ duration: 0.2, delay: 0.1 + (i * 0.05) }}
                                                                className="p-5 sm:p-6 hover:bg-muted/30 transition-colors"
                                                            >
                                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                                                                    <div className="flex items-center gap-3">
                                                                        {renderStars(rating.rating)}
                                                                        <Badge variant="secondary" className="text-[10px] font-mono tracking-wider bg-background/50">
                                                                            ORD-{rating.order_id.slice(0, 8).toUpperCase()}
                                                                        </Badge>
                                                                    </div>
                                                                    <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                                                                        {new Date(rating.created_at).toLocaleDateString('en-US', {
                                                                            year: 'numeric',
                                                                            month: 'short',
                                                                            day: 'numeric'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                
                                                                {rating.review ? (
                                                                    <p className="text-sm sm:text-base text-foreground/90 leading-relaxed bg-background/50 p-3 sm:p-4 rounded-xl border border-border/50 shadow-sm">
                                                                        "{rating.review}"
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                                                        Customer left a rating without a written review
                                                                    </p>
                                                                )}
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default VendorRatings;
