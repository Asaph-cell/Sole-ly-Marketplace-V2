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

// ─── Category pill nav (Mercari-style outlined pills, no emoji) ───────────────
const PILL_CATEGORIES = [
  { key: "all",            name: "All" },
  { key: "womens-fashion", name: "Women" },
  { key: "mens-fashion",   name: "Men" },
  { key: "kids",           name: "Kids" },
  { key: "shoes",          name: "Shoes" },
  { key: "electronics",    name: "Electronics" },
  { key: "beauty",         name: "Beauty" },
  { key: "bags",           name: "Bags" },
  { key: "sports",         name: "Sports" },
  { key: "home",           name: "Home" },
];

// ─── Category showcase cards ─────────────────────────────────────────────────
// Images from Unsplash matching the category feel
const SHOWCASE_CARDS = [
  {
    key: "electronics",
    name: "Electronics",
    subtitle: "Phones, laptops & accessories",
    // B&W Apple devices flatlay — matches uploaded reference
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=700&h=460&fit=crop&crop=center",
    bg: "bg-gray-100 dark:bg-gray-900",
    textColor: "text-gray-900 dark:text-gray-100",
  },
  {
    key: "womens-fashion",
    name: "Fashion",
    subtitle: "Women's, men's & kids' clothing",
    // Clothing rack — matches uploaded reference
    image: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=700&h=460&fit=crop&crop=center",
    bg: "bg-stone-100 dark:bg-stone-900",
    textColor: "text-stone-900 dark:text-stone-100",
  },
  {
    key: "shoes",
    name: "Shoes",
    subtitle: "Sneakers, boots & sandals",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&h=460&fit=crop&crop=center",
    bg: "bg-amber-50 dark:bg-amber-950",
    textColor: "text-amber-900 dark:text-amber-100",
  },
  {
    key: "bags",
    name: "Bags & Accessories",
    subtitle: "Handbags, wallets & more",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=700&h=460&fit=crop&crop=center",
    bg: "bg-rose-50 dark:bg-rose-950",
    textColor: "text-rose-900 dark:text-rose-100",
  },
  {
    key: "beauty",
    name: "Beauty",
    subtitle: "Makeup, skincare & haircare",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=700&h=460&fit=crop&crop=center",
    bg: "bg-purple-50 dark:bg-purple-950",
    textColor: "text-purple-900 dark:text-purple-100",
  },
  {
    key: "sports",
    name: "Sports & Fitness",
    subtitle: "Gear, apparel & equipment",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=700&h=460&fit=crop&crop=center",
    bg: "bg-green-50 dark:bg-green-950",
    textColor: "text-green-900 dark:text-green-100",
  },
];

// ─── How It Works steps ───────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    step: "1",
    icon: ShoppingBag,
    title: "Browse & Order",
    desc: "Find what you want from a verified vendor. Add to cart and checkout with M-Pesa.",
    color: "bg-primary/10 text-primary",
  },
  {
    step: "2",
    icon: Lock,
    title: "We Hold the Funds",
    desc: "Your money sits safely in escrow — the vendor cannot access it until delivery is confirmed.",
    color: "bg-green-100 text-green-700",
  },
  {
    step: "3",
    icon: Package,
    title: "Receive Your Package",
    desc: "Enter the 3-digit PIN on the package to confirm receipt. Your 6-digit release code appears.",
    color: "bg-blue-100 text-blue-700",
  },
  {
    step: "4",
    icon: Zap,
    title: "Funds Released",
    desc: "Show the vendor your release code. They enter it and money lands in their wallet instantly.",
    color: "bg-purple-100 text-purple-700",
  },
];

// ─── Trust stats ──────────────────────────────────────────────────────────────
const TRUST_STATS = [
  { value: "100%", label: "Escrow Protected", icon: Shield },
  { value: "0 KES", label: "Upfront Seller Fees", icon: Tag },
  { value: "24h", label: "Dispute Resolution", icon: CheckCircle },
  { value: "1,200+", label: "Active Vendors", icon: Users },
];

// ─── Component ────────────────────────────────────────────────────────────────
const Home = () => {
  const { isVendor } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // ── Fetch real products from Supabase ──────────────────────────────────────
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data: productsData } = await supabase
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
      } catch (err) {
        console.error("Home: failed to fetch products", err);
      } finally {
        setProductsLoading(false);
      }
    };
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
        canonical="https://solelyshoes.co.ke/"
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
                "💰 10% commission only when you sell — start for free today!",
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
                Shop Now <ArrowRight className="h-4 w-4" />
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
      {/* Mobile: horizontal snap-scroll; Desktop: 3-column grid */}
      <section className="py-6 sm:py-10">
        <div className="mb-4 flex items-baseline justify-between px-4 sm:px-6 lg:px-8 container mx-auto">
          <h2 className="text-lg sm:text-2xl font-bold">Shop by Category</h2>
          <Link to="/shop" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* ── Mobile carousel (hidden on md+, shown on phones < 768px) ── */}
        <div className="md:hidden flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pl-4 pr-4 pb-2">
          {SHOWCASE_CARDS.map((card) => (
            <Link
              key={card.key}
              to={`/shop?category=${card.key}`}
              className={`group relative flex-shrink-0 w-[85vw] overflow-hidden rounded-2xl ${card.bg} border border-border snap-start`}
              style={{ minHeight: "160px" }}
            >
              {/* Category image — fills right 60% */}
              <div className="absolute right-0 top-0 bottom-0 w-[62%] overflow-hidden">
                <img
                  src={card.image}
                  alt={card.name}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white/80 dark:from-black/80 to-transparent" />
              </div>
              {/* Text */}
              <div className="relative z-10 p-4 flex flex-col justify-between h-full">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-1">
                    {card.subtitle}
                  </p>
                  <h3 className={`text-xl font-extrabold leading-tight ${card.textColor}`}>
                    {card.name}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary mt-2">
                  See more <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Desktop 2-3 column grid (hidden below md / 768px) ── */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 container mx-auto px-6 lg:px-8">
          {SHOWCASE_CARDS.map((card, i) => (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
            >
              <Link
                to={`/shop?category=${card.key}`}
                className={`group relative flex overflow-hidden rounded-2xl ${card.bg} border border-border hover:shadow-lg transition-shadow duration-300`}
                style={{ minHeight: "200px" }}
              >
                <div className="relative z-10 p-5 flex flex-col justify-between flex-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-foreground/50 mb-1">
                      {card.subtitle}
                    </p>
                    <h3 className={`text-2xl font-extrabold ${card.textColor}`}>
                      {card.name}
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2 transition-all">
                    See more <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-[58%] overflow-hidden">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-white/60 dark:from-black/60 via-transparent to-transparent" />
                </div>
              </Link>
            </motion.div>
          ))}
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
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-xl sm:text-2xl font-bold">For You</h2>
                </div>
                <Link to="/shop" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                  See All <ArrowRight className="h-4 w-4" />
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
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
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
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── TRUST STATS STRIP ─── */}
      <section className="py-8 bg-muted/40 border-y border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {TRUST_STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-extrabold">{value}</p>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative bg-card border border-border rounded-2xl p-6 shadow-sm"
                >
                  <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="absolute top-4 right-5 text-4xl font-black text-muted/30">
                    {step.step}
                  </span>
                  <h3 className="font-bold text-base mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
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
                  "Zero listing fees — only 10% when you sell",
                  "Sell shoes, fashion, electronics, beauty & more",
                  "Your own store page with reviews & ratings",
                  "Real-time order tracking & payout dashboard",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start mt-8">
                {isVendor ? (
                  <Button size="lg" className="rounded-full" asChild>
                    <Link to="/vendor/dashboard">
                      <LayoutDashboard className="h-4 w-4 mr-2" /> My Dashboard
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" className="rounded-full" asChild>
                    <Link to="/vendor">
                      <Tag className="h-4 w-4 mr-2" /> Start Selling Free
                    </Link>
                  </Button>
                )}
                <Button size="lg" variant="outline" className="rounded-full border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10" asChild>
                  <Link to="/about">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-12 sm:py-16 bg-gradient-to-br from-secondary via-secondary to-secondary/90 text-secondary-foreground text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-3">Ready to Shop Safely?</h2>
          <p className="text-sm sm:text-lg mb-6 opacity-80 max-w-md mx-auto">
            Join thousands of Kenyans who shop without fear. Escrow protection on every order.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" className="rounded-full font-bold" asChild>
              <Link to="/shop">
                <ShoppingBag className="h-4 w-4 mr-2" /> Browse All Items
              </Link>
            </Button>
            {!isVendor && (
              <Button
                size="lg"
                variant="outline"
                className="rounded-full bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold transition-colors"
                asChild
              >
                <Link to="/vendor">Become a Vendor</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
