import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import {
  Shield, Lock, CheckCircle, Truck, ArrowRight,
  ShoppingBag, Tag, LayoutDashboard,
  Package, Star, Zap, Users, Sparkles, ChevronRight
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ALL_CATEGORIES } from "@/lib/categories";
import { PendingOrdersBanner } from "@/components/vendor/PendingOrdersBanner";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { saveSearch } from "@/lib/searchHistory";
import { rankByInterests, trackCategoryClick, hasInterestData, buildInterestProfile } from "@/lib/userInterests";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { StoreShowcase } from "@/components/home/StoreShowcase";

// ─── Category pill nav (Mercari-style outlined pills, no emoji) ───────────────
const PILL_CATEGORIES = [
  { key: "all",            name: "All" },
  { key: "womens-fashion", name: "Women" },
  { key: "mens-fashion",   name: "Men" },
  { key: "kids",           name: "Kids" },
  { key: "shoes",          name: "Shoes" },
  { key: "electronics",    name: "Electronics" },
  { key: "beauty",         name: "Beauty" },
  { key: "bags",           name: "Accessories" },
  { key: "sports",         name: "Sports" },
  { key: "home",           name: "Home" },
];

// ─── Category showcase cards ─────────────────────────────────────────────────
// Images from Unsplash matching the category feel
const SHOWCASE_CARDS = [
  {
    key: "electronics",
    name: "Electronics",
    subtitle: "Phones & accessories",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=700&h=460&fit=crop&crop=center",
    gradient: "from-[#F3F4F6] to-[#E5E7EB] dark:from-gray-900 dark:to-gray-800",
    fadeFrom: "from-[#F3F4F6] dark:from-gray-900",
  },
  {
    key: "womens-fashion",
    name: "Fashion",
    subtitle: "Premium clothing",
    image: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=700&h=460&fit=crop&crop=center",
    gradient: "from-[#F9FAFB] to-[#F3F4F6] dark:from-gray-800 dark:to-gray-700",
    fadeFrom: "from-[#F9FAFB] dark:from-gray-800",
  },
  {
    key: "shoes",
    name: "Shoes",
    subtitle: "Leather & Sneakers",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&h=460&fit=crop&crop=center",
    gradient: "from-[#FDFBF7] to-[#F3F0E6] dark:from-stone-900 dark:to-stone-800",
    fadeFrom: "from-[#FDFBF7] dark:from-stone-900",
  },
  {
    key: "bags",
    name: "Accessories",
    subtitle: "Luxury & everyday",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=700&h=460&fit=crop&crop=center",
    gradient: "from-[#FAF5F0] to-[#EBE3D5] dark:from-[#3D332D] dark:to-[#2D2520]",
    fadeFrom: "from-[#FAF5F0] dark:from-[#3D332D]",
  },
  {
    key: "beauty",
    name: "Beauty",
    subtitle: "Beauty style",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=700&h=460&fit=crop&crop=center",
    gradient: "from-[#F8F3ED] to-[#E9DFD1] dark:from-[#4A3F35] dark:to-[#3A3028]",
    fadeFrom: "from-[#F8F3ED] dark:from-[#4A3F35]",
  },
  {
    key: "sports",
    name: "Sports & Fitness",
    subtitle: "Athletic, fitness",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=700&h=460&fit=crop&crop=center",
    gradient: "from-[#F8FAFC] to-[#E2E8F0] dark:from-slate-900 dark:to-slate-800",
    fadeFrom: "from-[#F8FAFC] dark:from-slate-900",
  },
];

// ─── How It Works steps ───────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    step: "01",
    icon: ShoppingBag,
    title: "Browse & Order",
    desc: "Find what you want from a verified vendor. Add to cart and checkout with M-Pesa.",
  },
  {
    step: "02",
    icon: Lock,
    title: "We Hold the Funds",
    desc: "Your money sits safely in escrow — the vendor cannot access it until delivery is confirmed.",
  },
  {
    step: "03",
    icon: Package,
    title: "Receive Your Package",
    desc: "Enter the 3-digit PIN on the package to confirm receipt. Your 6-digit release code appears.",
  },
  {
    step: "04",
    icon: Zap,
    title: "Funds Released",
    desc: "Show the vendor your release code. They enter it and money lands in their wallet instantly.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
const Home = () => {
  const { isVendor } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch real products from Supabase ──────────────────────────────────────
  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      setError(null);
      const { data: productsData, error: fetchErr } = await supabase
          .from("products")
          .select("*")
          .eq("status", "active")
          .limit(60);

        const { data: reviewsData } = await supabase
          .from("reviews")
          .select("product_id, rating");

        const reviewStats: Record<string, { sum: number; count: number }> = {};
        (reviewsData || []).forEach((r) => {
          if (!reviewStats[r.product_id]) reviewStats[r.product_id] = { sum: 0, count: 0 };
          reviewStats[r.product_id].sum   += r.rating;
          reviewStats[r.product_id].count += 1;
        });

        const enriched = (productsData || []).map((p) => {
          const s = reviewStats[p.id];
          return {
            ...p,
            price:         p.price_ksh,
            image:         p.images?.[0] || "/placeholder.svg",
            averageRating: s ? s.sum / s.count : null,
            reviewCount:   s?.count ?? 0,
          };
        });

        setProducts(enriched);
      } catch (err: any) {
        console.error("Home: failed to fetch products", err);
        setError(err.message || "Failed to load products. Please check your connection and try again.");
      } finally {
        setProductsLoading(false);
      }
    };

  useEffect(() => {
    fetchProducts();
  }, []);

  // ── Category tab filter ────────────────────────────────────────────────────
  const filteredProducts =
    activeTab === "all"
      ? products
      : products.filter((p) => p.category === activeTab);

  // ── Personalised "For You" products ────────────────────────────────────────
  const personalized   = hasInterestData();
  const profile        = buildInterestProfile();
  const forYouProducts = personalized
    ? rankByInterests([...products]).slice(0, 12)
    : [];

  const reasonChip = profile.reasonLabels.length > 0
    ? `Because you browsed ${profile.reasonLabels
        .slice(0, 2)
        .map((l) => l.charAt(0).toUpperCase() + l.slice(1))
        .join(" & ")}`
    : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SEO
        title="Solely — Kenya's Safest Way to Buy & Sell Anything"
        description="Shop electronics, fashion, shoes, beauty, and more with full escrow protection. Kenya's most trusted social commerce marketplace."
        canonical="https://solelymarketplace.com/"
        isHomepage={true}
      />

      <PendingOrdersBanner />

      {/* ─── VENDOR TICKER ─── */}
      {!isVendor && (
        <Link to="/vendor" className="block bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity">
          <div className="overflow-hidden whitespace-nowrap py-1.5">
            <div className="inline-block animate-[scroll_30s_linear_infinite]">
              {[
                "👟 Sell shoes, fashion & electronics — zero upfront fees!",
                "🔒 Every order is escrow-protected — no more payment scams!",
                "💰 6% commission only when you sell — start for free today!",
                "📱 Sell electronics with verified KYC protection!",
                "👗 List your fashion items and reach thousands of buyers!",
                "🚀 Kenya's most trusted marketplace — join 1,200+ vendors!",
              ].map((text, i) => (
                <span key={i} className="inline-block px-10 text-xs sm:text-sm font-medium">
                  {text}
                </span>
              ))}
            </div>
          </div>
        </Link>
      )}

      {/* ─── PILL CATEGORY NAV ─── */}
      <div className="bg-background border-b border-border">
        <div className="px-3 sm:container sm:mx-auto sm:px-4">
          <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide py-2.5">
            {PILL_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                id={`cat-pill-${cat.key}`}
                onClick={() => {
                  setActiveTab(cat.key);
                  trackCategoryClick(cat.key);
                  if (cat.key !== "all") {
                    navigate(`/shop?category=${cat.key}`);
                  }
                }}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150
                  ${activeTab === cat.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/40"
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── HERO BANNER ─── */}
      <section className="relative overflow-hidden" style={{ minHeight: "320px" }}>
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1600&h=700&fit=crop&crop=center')",
          }}
        />
        {/* Heavy dark overlay on mobile so text is always readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20" />

        <div className="relative container mx-auto px-5 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-28">
          <div className="max-w-lg">
            <Badge className="mb-3 bg-primary/90 text-primary-foreground border-0 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
              Escrow Protected · Zero Scams
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-3">
              Fresh Drops.<br />
              <span className="text-primary">Zero Scams.</span>
            </h1>
            <p className="text-white/75 text-sm sm:text-base mb-6 leading-relaxed">
              Every order on Solely is escrow-protected. Shop with confidence — shoes, electronics, fashion &amp; more.
            </p>
            {/* On mobile: stacked full-width buttons; on sm+: side by side */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/shop"
                className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-full transition-colors text-sm"
              >
                Shop Now <ArrowRight size={16} strokeWidth={1.5}  />
              </Link>
              {!isVendor && (
                <Link
                  to="/vendor"
                  className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/30 font-semibold px-6 py-3 rounded-full transition-colors text-sm"
                >
                  Start Selling Free
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CATEGORY SHOWCASE CARDS ─── */}
      <section className="py-6 sm:py-10">
        <div className="mb-6 flex items-baseline justify-between px-4 sm:px-6 lg:px-8 container mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold">Shop by Category</h2>
          <Link to="/shop" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
            See all <ArrowRight size={14} strokeWidth={1.5}  />
          </Link>
        </div>

        {/* ── Unified Responsive Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 container mx-auto px-4 sm:px-6 lg:px-8">
          {SHOWCASE_CARDS.map((card, i) => {
            const isLastOdd = i === SHOWCASE_CARDS.length - 1 && SHOWCASE_CARDS.length % 2 !== 0;
            return (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className={isLastOdd ? "col-span-2 sm:col-span-1" : ""}
              >
                <Link
                  to={`/shop?category=${card.key}`}
                  className={`group relative flex overflow-hidden rounded-3xl bg-gradient-to-r ${card.gradient} border border-border/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-[130px] sm:h-[180px] lg:h-[200px]`}
                >
                  {/* Image on the right */}
                  <div className="absolute right-0 top-0 bottom-0 w-[55%] sm:w-[60%] overflow-hidden">
                    <img
                      src={card.image}
                      alt={card.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                    />
                    {/* Fade from left to right to blend image into the card background */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${card.fadeFrom} via-transparent to-transparent`} />
                  </div>

                  {/* Text on the left */}
                  <div className="relative z-10 p-3 sm:p-5 lg:p-8 flex flex-col justify-center flex-1 max-w-[65%] sm:max-w-[60%]">
                    <p className="text-[clamp(0.65rem,2.2vw,0.875rem)] font-medium text-muted-foreground mb-1 opacity-90 leading-tight">
                      {card.subtitle}
                    </p>
                    <h3 className="text-[clamp(0.9rem,3.5vw,1.5rem)] font-extrabold text-foreground mb-2 sm:mb-4 tracking-tight leading-none break-words hyphens-auto">
                      {card.name}
                    </h3>
                    <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-sm font-medium text-primary group-hover:gap-2 transition-all">
                      See more <ChevronRight size={16} strokeWidth={1.5}  />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─── FOR YOU SECTION ─── */}
      <AnimatePresence>
        {personalized && forYouProducts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="py-8 sm:py-12 bg-primary/5 border-y border-primary/10"
          >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={20} strokeWidth={1.5} className=" text-primary" />
                  <h2 className="text-xl sm:text-2xl font-bold">For You</h2>
                </div>
                <Link to="/shop" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                  See All <ArrowRight size={16} strokeWidth={1.5}  />
                </Link>
              </div>
              {reasonChip && (
                <p className="text-xs text-muted-foreground mb-5 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                  {reasonChip}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                {forYouProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    brand={product.brand}
                    averageRating={product.averageRating}
                    reviewCount={product.reviewCount}
                    createdAt={product.created_at}
                    condition={product.condition || "new"}
                    videoUrl={product.video_url}
                    freeDelivery={product.free_delivery}
                  />
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ─── TRENDING PRODUCT GRID ─── */}
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold">Trending Now</h2>
            <Link to="/shop" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight size={16} strokeWidth={1.5}  />
            </Link>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center min-h-[30vh] text-center px-4 bg-background rounded-2xl border border-border p-8 shadow-sm">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Oops! Something went wrong</h2>
              <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
              <Button onClick={fetchProducts} size="lg">
                Try Again
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag strokeWidth={1.5} className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No items in this category yet.</p>
              <p className="text-sm mt-1">Be the first to list here!</p>
              <Button className="mt-4 rounded-full" asChild>
                <Link to="/vendor">Start Selling</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredProducts.slice(0, 24).map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  image={product.image}
                  brand={product.brand}
                  averageRating={product.averageRating}
                  reviewCount={product.reviewCount}
                  createdAt={product.created_at}
                  condition={product.condition || "new"}
                  videoUrl={product.video_url}
                  freeDelivery={product.free_delivery}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── STORE SHOWCASE ─── */}
      <StoreShowcase />

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-3 text-xs font-bold uppercase tracking-widest px-3 py-1">
              Zero-Scam Guarantee
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold">How Solely Protects You</h2>
            <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
              Our 4-step escrow protocol means your money is always safe — whether you're buying or selling.
            </p>
          </div>

          <div className="relative flex flex-col gap-0 max-w-2xl mx-auto mt-8 text-left">
            <div className="absolute left-[17px] top-[18px] bottom-[18px] w-[2px] bg-border" />
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative z-10 flex flex-nowrap items-start gap-4 pb-8 last:pb-0"
                >
                  <div className="w-9 h-9 flex-shrink-0 rounded-full border-2 border-primary bg-background flex items-center justify-center text-sm font-medium text-primary">
                    {i + 1}
                  </div>
                  <div className="pt-1.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={14} strokeWidth={1.5} className="text-primary" />
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── VENDOR CTA ─── */}
      <section className="py-12 sm:py-16 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <Badge className="mb-4 bg-primary/20 text-primary border-primary/30 text-xs font-bold uppercase tracking-widest">
                For Vendors
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-extrabold mb-4 leading-tight">
                Sell Without the Risk.<br />
                <span className="text-primary">Get Paid, Every Time.</span>
              </h2>
              <p className="text-secondary-foreground/80 max-w-md mx-auto lg:mx-0 text-sm sm:text-base leading-relaxed">
                Solely's escrow system protects vendors too — once the buyer confirms receipt,
                your money is released instantly. No chargebacks, no "I never got it" scams.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Zero listing fees — only 6% when you sell",
                  "Sell shoes, fashion, electronics, beauty & more",
                  "Your own store page with reviews & ratings",
                  "Real-time order tracking & payout dashboard",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <CheckCircle size={16} strokeWidth={1.5} className=" text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start mt-8">
                {isVendor ? (
                  <Button size="lg" className="rounded-full" asChild>
                    <Link to="/vendor/dashboard">
                      <LayoutDashboard size={16} strokeWidth={1.5} className=" mr-2" /> My Dashboard
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" className="rounded-full" asChild>
                    <Link to="/vendor">
                      <Tag size={16} strokeWidth={1.5} className=" mr-2" /> Start Selling Free
                    </Link>
                  </Button>
                )}
                <Button size="lg" variant="outline" className="rounded-full bg-transparent border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground" asChild>
                  <Link to="/about">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
