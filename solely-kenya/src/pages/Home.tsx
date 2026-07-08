import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import {
  Shield, Lock, CheckCircle, Truck, ArrowRight,
  ShoppingBag, Tag, LayoutDashboard,
  Package, Star, Zap, Users, Sparkles, ChevronRight, Link2, MessageCircle
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
  { key: "health",         name: "Health" },
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
    title: "Order Securely",
    desc: "Checkout and pay securely via M-Pesa. Your money goes into our safe escrow, not directly to the seller.",
  },
  {
    step: "02",
    icon: Lock,
    title: "Money is Locked",
    desc: "The vendor ships your order. We keep your funds locked and fully protected during transit.",
  },
  {
    step: "03",
    icon: Package,
    title: "Inspect Your Item",
    desc: "Receive your package and inspect it to ensure it matches exactly what you ordered.",
  },
  {
    step: "04",
    icon: Zap,
    title: "Release Payment",
    desc: "Happy with it? Give the vendor your unique 6-digit release code to instantly unlock their funds.",
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
  const [marqueeVendors, setMarqueeVendors] = useState<string[]>([]);

  // ── Fetch registered vendors for marquee ──────────────────────────────────
  const fetchMarqueeVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("store_name")
        .not("store_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(15);
      
      if (!error && data) {
        // Filter out empty strings if any exist despite the null check
        const names = data.map(v => v.store_name).filter(name => name && name.trim().length > 0);
        if (names.length > 0) {
          setMarqueeVendors(names);
        }
      }
    } catch (err) {
      console.error("Failed to fetch marquee vendors", err);
    }
  };

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
    fetchMarqueeVendors();
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
      <style>{`
        @keyframes sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-sweep {
          animation: sweep 2.5s infinite;
        }
      `}</style>
      <SEO
        title="Solely - Free to Use Website to Buy & Sell Safely in Kenya"
        description="Solely is a 100% free to use ecommerce website. Just log in and list your items for free! Shop and sell electronics, fashion, and shoes with M-Pesa escrow protection."
        canonical="https://solelymarketplace.com/"
        isHomepage={true}
        keywords={[
          "free to use website",
          "just log in and list your items",
          "sell online for free in Kenya",
          "free ecommerce platform Kenya",
          "buy and sell safely",
          "M-Pesa escrow marketplace",
          "list items for free",
          "online marketplace Nairobi"
        ]}
      />

      <PendingOrdersBanner />

      {/* ─── NEW HERO BANNER ─── */}
      <section className="relative overflow-hidden flex flex-col justify-center">
        {/* Background image (Maintained) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1600&h=700&fit=crop&crop=center')",
          }}
        />
        {/* Heavy dark overlay for experimental vibe */}
        <div className="absolute inset-0 bg-slate-950/80 mix-blend-multiply" />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, delay: 0.5 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] bg-primary/20 blur-[100px] sm:blur-[120px] rounded-full pointer-events-none z-0" 
        />

        {/* Left Floating Card - Escrow */}
        <motion.div
          initial={{ opacity: 0, x: -40, y: 10 }}
          animate={{ opacity: 1, x: 0, y: [0, -10, 0] }}
          transition={{ opacity: { duration: 0.8, delay: 1 }, y: { repeat: Infinity, duration: 4, ease: "easeInOut" } }}
          className="hidden xl:flex absolute top-[30%] left-[5%] 2xl:left-[10%] bg-white/10 backdrop-blur-md border border-white/20 p-3.5 pr-6 rounded-2xl shadow-2xl items-center gap-4 z-20 pointer-events-none"
        >
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <Lock className="text-amber-400 w-5 h-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">M-Pesa Escrow</span>
            <span className="text-sm text-white font-bold">Funds Locked 🔒</span>
          </div>
        </motion.div>

        {/* Right Floating Card - Delivery */}
        <motion.div
          initial={{ opacity: 0, x: 40, y: -10 }}
          animate={{ opacity: 1, x: 0, y: [0, 10, 0] }}
          transition={{ opacity: { duration: 0.8, delay: 1.2 }, y: { repeat: Infinity, duration: 5, ease: "easeInOut" } }}
          className="hidden xl:flex absolute bottom-[30%] right-[5%] 2xl:right-[10%] bg-white/10 backdrop-blur-md border border-white/20 p-3.5 pr-6 rounded-2xl shadow-2xl items-center gap-4 z-20 pointer-events-none"
        >
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <CheckCircle className="text-green-400 w-5 h-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Order Delivered</span>
            <span className="text-sm text-white font-bold">Funds Released ✅</span>
          </div>
        </motion.div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 flex flex-col items-center text-center">
          
          {/* Trust Badge */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="mb-8"
          >
            <Badge className="bg-primary/90 text-primary-foreground border-0 text-[10px] sm:text-xs font-bold uppercase tracking-widest px-3 py-1.5 shadow-lg">
              <Shield size={14} className="mr-1.5 inline-block mb-[2px]" />
              Escrow Protected · Zero Scams
            </Badge>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, type: "spring", stiffness: 100 }}
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-[1.15] text-white"
          >
            The Safest Way to Buy & Sell. <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-400 italic font-serif font-normal">
              Zero
            </span> 'Character Development'.
          </motion.h1>

          {/* Subheadline */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
            className="text-lg md:text-xl text-slate-200 max-w-2xl mb-8 leading-relaxed"
          >
            We hold your money safely in escrow until your order arrives exactly as promised. 
            Kill ghost shops. Build instant trust. Share secure payment links everywhere.
          </motion.p>

          {/* Dual-Path CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          >
            {/* Buyer Path */}
            <button 
              onClick={() => document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto"
            >
              <Button size="lg" className="relative overflow-hidden w-full sm:w-auto rounded-full text-base h-14 px-8 font-bold shadow-[0_0_40px_-5px_rgba(var(--primary),0.8)] bg-primary text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-105 group">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-sweep" />
                <ShoppingBag className="mr-2 w-5 h-5 relative z-10" /> 
                <span className="relative z-10">Browse Marketplace</span>
              </Button>
            </button>

            {/* Vendor Path */}
            <Link to={!isVendor ? "/vendor" : "/vendor-dashboard"} className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full text-base h-14 px-8 font-bold bg-black/40 backdrop-blur-md border-slate-500 text-white hover:bg-white/10 hover:text-white hover:border-slate-400 transition-transform hover:scale-105">
                <LayoutDashboard className="mr-2 w-5 h-5" /> {!isVendor ? "Start Selling" : "Vendor Dashboard"}
              </Button>
            </Link>
          </motion.div>



          {/* Trust Guarantees */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="flex flex-wrap justify-center items-center gap-6 mt-12 text-sm text-slate-300 font-medium"
          >
            <span className="flex items-center gap-2"><CheckCircle size={16} className="text-green-400"/> Funds held in Escrow</span>
            <span className="flex items-center gap-2"><CheckCircle size={16} className="text-green-400"/> Release on Delivery</span>
            <span className="flex items-center gap-2"><CheckCircle size={16} className="text-green-400"/> Dispute Protection</span>
          </motion.div>
        </div>
      </section>

      {/* ─── TRUSTED BY BANNER ─── */}
      <section className="border-b border-border/40 bg-slate-100 dark:bg-black/60 overflow-hidden py-5 sm:py-6 relative z-10">
        <div className="flex flex-col items-center">
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
            Trusted by top sellers across Kenya
          </p>
          <div className="w-full flex flex-nowrap overflow-hidden relative">
            {/* Left gradient overlay */}
            <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-slate-100 dark:from-[rgba(0,0,0,0.6)] to-transparent z-10 pointer-events-none" />
            {/* Right gradient overlay */}
            <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-slate-100 dark:from-[rgba(0,0,0,0.6)] to-transparent z-10 pointer-events-none" />
            <div className="animate-[scroll_30s_linear_infinite] flex flex-nowrap min-w-max items-center shrink-0">
              {(marqueeVendors.length > 0 ? marqueeVendors : [
                "Sneakerhead KE", "The Thrift Lab", "Urban Kicks NBO", "TechHub Kenya", 
                "Glamour Boutique", "Nairobi Vintage", "Hypebeast Africa", "Gadget Galaxy", 
                "Retro Wear KE"
              ]).map((name, i) => (
                <div key={i} className="flex items-center shrink-0 mx-6 sm:mx-10 text-slate-700 dark:text-slate-300 font-extrabold tracking-tight text-sm sm:text-base opacity-70 hover:opacity-100 transition-opacity">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mr-3 hidden sm:block" />
                  {name}
                </div>
              ))}
            </div>
            {/* Duplicate for seamless looping */}
            <div className="animate-[scroll_30s_linear_infinite] flex flex-nowrap min-w-max items-center shrink-0" aria-hidden="true">
              {(marqueeVendors.length > 0 ? marqueeVendors : [
                "Sneakerhead KE", "The Thrift Lab", "Urban Kicks NBO", "TechHub Kenya", 
                "Glamour Boutique", "Nairobi Vintage", "Hypebeast Africa", "Gadget Galaxy", 
                "Retro Wear KE"
              ]).map((name, i) => (
                <div key={i} className="flex items-center shrink-0 mx-6 sm:mx-10 text-slate-700 dark:text-slate-300 font-extrabold tracking-tight text-sm sm:text-base opacity-70 hover:opacity-100 transition-opacity">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mr-3 hidden sm:block" />
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How Solely Works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Whether you are buying a fresh pair of sneakers or selling premium electronics, we make sure everyone is protected.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div 
                  key={step.step}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.15 }}
                  className="flex flex-col items-center text-center p-6 bg-background rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
                    <Icon size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Removed anchor to place it lower */}

      {/* ─── SELL ON SOCIALS BANNER ─── */}
      {!isVendor && (
        <section className="py-20 bg-gradient-to-br from-primary/30 via-primary/10 to-primary/5 border-y border-primary/30 relative overflow-hidden">
          {/* Abstract background pattern (Fun & Random Memphis SVG) */}
          <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none" 
               style={{ 
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23000' stroke-width='2'%3E%3Cpath d='M20,40 Q30,20 40,40 T60,40' /%3E%3Ccircle cx='150' cy='50' r='10' /%3E%3Cpath d='M40,140 L60,160 M60,140 L40,160' /%3E%3Cpolygon points='140,160 150,140 160,160' /%3E%3Ccircle cx='90' cy='90' r='3' fill='%23000' stroke='none' /%3E%3Ccircle cx='100' cy='110' r='2' fill='%23000' stroke='none' /%3E%3Ccircle cx='110' cy='90' r='4' fill='%23000' stroke='none' /%3E%3C/g%3E%3C/svg%3E")`
               }} 
          />
          {/* Large Abstract Orbs */}
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-background/40 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-64 h-64 bg-primary/20 rounded-full blur-[60px] pointer-events-none" />

          <div className="container mx-auto px-6 relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="max-w-xl text-center lg:text-left">
                <Badge variant="outline" className="mb-6 bg-background/50 border-primary/30 text-primary py-1.5 px-4 text-xs font-semibold uppercase tracking-wider shadow-sm">
                  🚀 For Sellers & Creators
                </Badge>
                <h2 className="text-4xl sm:text-5xl font-extrabold mb-6 tracking-tight leading-[1.15] text-foreground">
                  Sell on your platforms, <br className="hidden sm:block" />
                  <span className="text-primary">Securely.</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  You don't need to force your customers to browse our website. Generate a secure <strong className="text-foreground">Payment Link</strong> from your dashboard and drop it in their DMs. We handle the M-Pesa checkout and escrow protection automatically.
                </p>
                <Button size="lg" className="rounded-full px-8 h-14 font-bold text-base shadow-[0_8px_30px_-4px_rgba(255,215,0,0.4)] hover:scale-105 transition-all" asChild>
                  <Link to="/vendor">Start Selling Now <ArrowRight className="ml-2" size={18} strokeWidth={2.5} /></Link>
                </Button>
              </div>
              
              {/* Visual Graphic */}
              <div className="hidden lg:flex gap-4 items-center pr-4 lg:pr-8">
                <div className="flex flex-col gap-5 relative">
                  {/* Decorative connecting line */}
                  <div className="absolute left-9 top-10 bottom-10 w-[2px] bg-gradient-to-b from-blue-400 via-green-400 to-primary/60 -z-10" />

                  <div className="bg-gradient-to-br from-white/95 to-white/70 dark:from-slate-900/95 dark:to-slate-900/70 backdrop-blur-2xl p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-white dark:border-white/20 rounded-2xl rotate-[-4deg] hover:rotate-0 hover:scale-[1.03] transition-all duration-300 w-72">
                     <div className="flex items-center gap-4 mb-2">
                       <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner"><Link2 size={18} strokeWidth={2.5} /></div>
                       <p className="font-bold text-base text-foreground">1. Create Link</p>
                     </div>
                     <p className="text-sm text-muted-foreground pl-14">Generate link for your custom item.</p>
                  </div>

                  <div className="bg-gradient-to-br from-white/95 to-white/70 dark:from-slate-900/95 dark:to-slate-900/70 backdrop-blur-2xl p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-white dark:border-white/20 rounded-2xl rotate-[3deg] hover:rotate-0 hover:scale-[1.03] transition-all duration-300 w-72 translate-x-8">
                     <div className="flex items-center gap-4 mb-2">
                       <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-inner"><MessageCircle size={18} strokeWidth={2.5} /></div>
                       <p className="font-bold text-base text-foreground">2. Share in DMs</p>
                     </div>
                     <p className="text-sm text-muted-foreground pl-14">Drop `sole.ly/pay/123` in WhatsApp.</p>
                  </div>

                  <div className="bg-gradient-to-br from-white/95 to-white/70 dark:from-slate-900/95 dark:to-slate-900/70 backdrop-blur-2xl p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-white dark:border-white/20 rounded-2xl rotate-[-2deg] hover:rotate-0 hover:scale-[1.03] transition-all duration-300 w-72">
                     <div className="flex items-center gap-4 mb-2">
                       <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shadow-inner"><Shield size={18} strokeWidth={2.5} /></div>
                       <p className="font-bold text-base text-foreground">3. Get Paid Safely</p>
                     </div>
                     <p className="text-sm text-muted-foreground pl-14">Buyer checks out with M-Pesa Escrow.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── VENDOR TICKER ─── */}
      {!isVendor && (
        <Link to="/vendor" className="block bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity">
          <div className="overflow-hidden whitespace-nowrap py-1.5">
            <div className="inline-block animate-[scroll_30s_linear_infinite]">
              {[
                "👟 Sell shoes, fashion & electronics - zero upfront fees!",
                "🔒 Every order is escrow-protected, no more payment scams!",
                "💰 6% commission only when you sell, start for free today!",
                "📱 Sell electronics with verified KYC protection!",
                "👗 List your fashion items and reach thousands of buyers!",
                "🚀 Kenya's most trusted marketplace - join 1,200+ vendors!",
              ].map((text, i) => (
                <span key={i} className="inline-block px-10 text-xs sm:text-sm font-medium">
                  {text}
                </span>
              ))}
            </div>
          </div>
        </Link>
      )}

      {/* Anchor for scrolling to shop */}
      <div id="shop-section" className="scroll-mt-20" />

      {/* ─── PILL CATEGORY NAV ─── */}
      <div className="bg-background border-b border-border sticky top-[56px] lg:top-[64px] z-30 shadow-sm">
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
                    description={product.description}
                    averageRating={product.averageRating}
                    reviewCount={product.reviewCount}
                    createdAt={product.created_at}
                    condition={product.condition || "new"}
                    videoUrl={product.video_url}
                    freeDelivery={product.free_delivery}
                    category={product.category}
                    vendorId={product.vendor_id}
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
                  description={product.description}
                  averageRating={product.averageRating}
                  reviewCount={product.reviewCount}
                  createdAt={product.created_at}
                  condition={product.condition || "new"}
                  videoUrl={product.video_url}
                  freeDelivery={product.free_delivery}
                  category={product.category}
                  vendorId={product.vendor_id}
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
