import { useState, useEffect } from "react";
import { ProductGridSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import {
  Shield, Lock, Check, ArrowRight, ArrowUpRight,
  ShoppingBag, Tag, LayoutDashboard,
  Package, KeyRound, Wallet, ChevronRight, Link2, MessageCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PendingOrdersBanner } from "@/components/vendor/PendingOrdersBanner";
import { SEO } from "@/components/SEO";
import { rankByInterests, trackCategoryClick, hasInterestData, buildInterestProfile } from "@/lib/userInterests";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

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
// `span` drives the desktop zig-zag (7/5, 5/7, 7/5 on a 12-col grid) so the
// row doesn't read as a uniform template grid.
const SHOWCASE_CARDS = [
  {
    key: "electronics",
    name: "Electronics",
    subtitle: "Phones and accessories",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&h=520&fit=crop&crop=center",
    span: "lg:col-span-7",
  },
  {
    key: "womens-fashion",
    name: "Fashion",
    subtitle: "Clothing from local boutiques",
    image: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=700&h=520&fit=crop&crop=center",
    span: "lg:col-span-5",
  },
  {
    key: "shoes",
    name: "Shoes",
    subtitle: "Leather and sneakers",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&h=520&fit=crop&crop=center",
    span: "lg:col-span-5",
  },
  {
    key: "bags",
    name: "Accessories",
    subtitle: "Bags, watches, jewellery",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=900&h=520&fit=crop&crop=center",
    span: "lg:col-span-7",
  },
  {
    key: "beauty",
    name: "Beauty",
    subtitle: "Skincare and makeup",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&h=520&fit=crop&crop=center",
    span: "lg:col-span-7",
  },
  {
    key: "sports",
    name: "Sports and fitness",
    subtitle: "Gym, running, outdoor",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=700&h=520&fit=crop&crop=center",
    span: "lg:col-span-5",
  },
];

// ─── How It Works steps ───────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Wallet,
    short: "Pay",
    title: "Pay with M-Pesa",
    desc: "You check out with M-Pesa. The money goes into a Solely holding account, not to the seller.",
    image: "/images/how-it-works/1-order.jpg"
  },
  {
    step: "02",
    icon: Lock,
    short: "Held",
    title: "We hold the money",
    desc: "The seller ships knowing you've paid. You know they can't take the money and disappear.",
    image: "/images/how-it-works/2-locked.png"
  },
  {
    step: "03",
    icon: Package,
    short: "Inspect",
    title: "Inspect your item",
    desc: "Open the package and check it against the listing. Something wrong? Open a dispute and our team reviews it within 24 hours.",
    image: "/images/how-it-works/3-inspect.jpg"
  },
  {
    step: "04",
    icon: KeyRound,
    short: "Release",
    title: "Confirm and release",
    desc: "Enter your delivery PIN and share the release code. The seller gets paid on the spot. If the order never arrives, you get a full refund.",
    image: "/images/how-it-works/4-release.png"
  },
];

const SELLER_STEPS = [
  { icon: Link2,         title: "Create a protected link",   desc: "List the item once and get a checkout link to share." },
  { icon: MessageCircle, title: "Drop it in the chat",        desc: "WhatsApp, Instagram, TikTok, wherever your customers are." },
  { icon: Shield,        title: "Get paid on delivery",       desc: "The buyer confirms and you're paid. If they go quiet after confirming, the money releases to you after 6 hours." },
];

// ─── Component ────────────────────────────────────────────────────────────────
const Home = () => {
  const { isVendor } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [activeTab, setActiveTab] = useState("all");
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marqueeVendors, setMarqueeVendors] = useState<string[]>([]);

  // ── Fetch registered vendors for marquee ──────────────────────────────────
  const fetchMarqueeVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("public_vendor_profiles")
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

  const scrollToShop = () =>
    document.getElementById("shop-section")?.scrollIntoView({ behavior: "smooth" });

  const renderProductCard = (product: any) => (
    <ProductCard
      key={product.id}
      id={product.id}
      name={product.name}
      price={product.price}
      originalPrice={product.original_price}
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
  );

  const sectionLink = (to: string, label = "See all") => (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 py-3 -my-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowRight size={14} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );

  return (
    // The route wrapper already fades the page in; a second 1.2s full-page
    // brightness filter here only delayed first paint and cost GPU time.
    <div data-layout="designed" className="min-h-screen overflow-x-clip bg-background">
      <SEO
        title="Kenya's Safest Way to Buy and Sell Online"
        description="Your money is protected until you get what you ordered. Sellers get paid when buyers are happy. Send secure M-Pesa payment links on WhatsApp, Instagram & TikTok. No scams. No fees to start."
        canonical="https://solelymarketplace.com/"
        isHomepage={true}
        keywords={[
          "buy safely online Kenya",
          "sell safely online Kenya",
          "safe online payments Kenya",
          "M-Pesa buyer protection",
          "sell on WhatsApp safely",
          "sell on Instagram Kenya",
          "protected online payments",
          "safe online shopping Kenya"
        ]}
      />

      <PendingOrdersBanner />

      {/* Sticky scope: the hero only stays pinned while the first sections
          slide over it. Pinning it for the whole page left a full-screen
          photo behind everything, which flashed through on fast scrolls
          before the content above it finished painting. */}
      <div className="relative">
      {/* ─── HERO ─── */}
      <section className="bg-grain relative overflow-hidden flex flex-col justify-center min-h-[100svh] sticky top-0 z-0 text-white">
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: EASE_OUT }}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1800&h=1100&fit=crop&crop=center')",
          }}
        />
        {/* Warm off-black scrim, heavier on the text side */}
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(30_14%_5%/0.94)] via-[hsl(30_14%_5%/0.78)] to-[hsl(30_14%_5%/0.45)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[hsl(30_14%_5%/0.8)] to-transparent" />

        <div className="relative z-10 container mx-auto px-6 pt-16 pb-10 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05, ease: EASE_OUT }}
              className="mb-7 flex items-center gap-3 text-sm font-medium text-white/70"
            >
              <span className="h-px w-8 bg-primary" />
              Buyer protection on every order
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
              className="font-display font-normal text-[2.75rem] leading-[0.98] sm:text-6xl lg:text-7xl xl:text-[5.25rem] tracking-[-0.01em] [text-wrap:balance]"
            >
              Sell and shop on social media,{" "}
              <span className="font-serif italic font-normal tracking-[-0.01em] text-primary">
                without the scams.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE_OUT }}
              className="mt-7 max-w-[34rem] text-lg md:text-xl text-white/75 leading-relaxed [text-wrap:pretty]"
            >
              You pay with M-Pesa. We hold the money until your order arrives, then pay the seller when you confirm.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.28, ease: EASE_OUT }}
              className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7"
            >
              <Button
                size="lg"
                asChild
                className="h-14 rounded-full px-8 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_12px_32px_-10px_hsl(var(--primary)/0.7)] transition-[transform,background-color] duration-200 active:scale-[0.97]"
              >
                <Link to={!isVendor ? "/vendor" : "/vendor/dashboard"}>
                  {!isVendor ? "Start selling free" : "Vendor dashboard"}
                  <ArrowRight className="ml-2 w-4 h-4" strokeWidth={2} />
                </Link>
              </Button>

              <button
                type="button"
                onClick={scrollToShop}
                className="group inline-flex items-center justify-center gap-2 h-14 sm:h-auto text-base font-medium text-white/85 hover:text-white transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-black"
              >
                <span className="underline decoration-white/30 underline-offset-[6px] group-hover:decoration-white transition-colors">
                  Shop local sellers
                </span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={1.75} />
              </button>
            </motion.div>
          </div>

          {/* Escrow receipt: shows the mechanism instead of claiming it */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: EASE_OUT }}
            className="hidden lg:block lg:col-span-5 lg:justify-self-end w-full max-w-[380px]"
            aria-hidden="true"
          >
            <div className="rounded-[1.75rem] bg-white/[0.07] backdrop-blur-xl p-6 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_30px_80px_-20px_hsl(30_20%_2%/0.8)] ring-1 ring-white/10">
              <div className="flex items-center justify-between text-xs text-white/55">
                <span>Order #SL-40917</span>
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <Lock className="w-3 h-3" /> Held by Solely
                </span>
              </div>
              <p className="mt-5 text-sm text-white/60">Leather ankle boots, size 41</p>
              <p className="mt-1 font-display font-normal text-4xl tracking-tight tabular-nums">KSh 4,850</p>

              <ol className="mt-6 space-y-3.5 text-sm">
                {[
                  { label: "Paid via M-Pesa", done: true },
                  { label: "Dispatched by seller", done: true },
                  { label: "Buyer confirms delivery", done: false },
                ].map((s) => (
                  <li key={s.label} className="flex items-center gap-3">
                    <span
                      className={`grid place-items-center w-5 h-5 rounded-md ${
                        s.done ? "bg-primary text-primary-foreground" : "ring-1 ring-white/25"
                      }`}
                    >
                      {s.done && <Check className="w-3 h-3" strokeWidth={3} />}
                    </span>
                    <span className={s.done ? "text-white/85" : "text-white/50"}>{s.label}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 rounded-xl bg-white/[0.06] px-4 py-3 text-xs leading-relaxed text-white/60">
                Solely pays the seller after the buyer confirms delivery. If it never arrives, the buyer gets it all back.
              </div>
            </div>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="lg:col-span-12 mt-4 lg:mt-10 grid sm:grid-cols-3 gap-y-3 sm:gap-x-8 border-t border-white/10 pt-6 text-sm text-white/65"
          >
            {[
              "We hold your money until delivery",
              "Full refund if your order never arrives",
              "M-Pesa checkout, no app to install",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <Check size={15} strokeWidth={2.25} className="text-primary shrink-0" />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* Sections that slide over the pinned hero */}
      <div className="relative z-10 bg-background">

      {/* ─── SELLER MARQUEE (only real, registered vendors) ─── */}
      {marqueeVendors.length > 0 && (
        <section className="border-b border-border/60 overflow-hidden py-6 sm:py-7">
          <div className="container mx-auto px-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-10">
            <p className="shrink-0 text-sm text-muted-foreground">
              Sellers already using<br className="hidden md:block" /> Solely checkout
            </p>
            <div className="relative flex flex-nowrap overflow-hidden min-w-0 flex-1 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  aria-hidden={copy === 1 ? "true" : undefined}
                  className="animate-[scroll_40s_linear_infinite] motion-reduce:animate-none flex flex-nowrap min-w-max items-center shrink-0"
                >
                  {marqueeVendors.map((name, i) => (
                    <span
                      key={i}
                      className="shrink-0 mx-7 sm:mx-9 font-display font-normal tracking-tight text-base sm:text-lg text-foreground/75"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-14 sm:py-16 lg:py-20 bg-sunken">
        <div className="container mx-auto px-6">
          <div
            className="grid lg:grid-cols-12 gap-4 lg:gap-12 items-end mb-8 lg:mb-12"
          >
            <h2 className="lg:col-span-7 font-display font-normal text-4xl md:text-5xl tracking-[-0.01em] leading-[1.02] [text-wrap:balance]">
              How your money stays safe
            </h2>
            <p className="lg:col-span-5 text-muted-foreground text-lg leading-relaxed max-w-md [text-wrap:pretty]">
              You pay, we hold it, and the seller gets paid once the item is in your hands. If something goes wrong, our team steps in within 24 hours.
            </p>
          </div>

          {/* ── Mobile View: Swipeable Carousel ── */}
          <div className="lg:hidden flex flex-col items-center w-full overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(e, { offset }) => {
                  if (offset.x < -50) {
                    setActiveStep((prev) => Math.min(prev + 1, HOW_IT_WORKS.length - 1));
                  } else if (offset.x > 50) {
                    setActiveStep((prev) => Math.max(prev - 1, 0));
                  }
                }}
                className="w-full bg-card rounded-[2rem] p-6 shadow-card flex flex-col cursor-grab active:cursor-grabbing"
              >
                <p className="text-xs font-medium text-muted-foreground tabular-nums mb-2">
                  Step {HOW_IT_WORKS[activeStep].step} of 04
                </p>
                <h3 className="font-display font-normal text-2xl tracking-tight mb-3 shrink-0">{HOW_IT_WORKS[activeStep].title}</h3>
                <div className="flex-grow mb-6">
                  <p className="text-muted-foreground text-[15px] leading-relaxed">
                    {HOW_IT_WORKS[activeStep].desc}
                  </p>
                </div>
                <div className="relative w-full h-[220px] rounded-2xl overflow-hidden shrink-0 mt-auto">
                  <img
                    src={HOW_IT_WORKS[activeStep].image}
                    alt={HOW_IT_WORKS[activeStep].title}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                </div>
              </motion.div>
            </AnimatePresence>
            {/* Pagination */}
            <div className="flex mt-6">
              {HOW_IT_WORKS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Show step ${idx + 1}: ${s.title}`}
                  aria-current={activeStep === idx ? "step" : undefined}
                  onClick={() => setActiveStep(idx)}
                  className="group grid place-items-center h-11 min-w-11"
                >
                  <span className={`block h-2.5 rounded-full transition-[width,background-color] duration-300 ${activeStep === idx ? "bg-foreground w-7" : "bg-foreground/20 w-2.5 group-hover:bg-foreground/40"}`} />
                </button>
              ))}
            </div>
          </div>

          {/* ── Desktop View: Interactive Accordion ── */}
          <div className="hidden lg:flex flex-row gap-3 w-full h-[420px]">
            {HOW_IT_WORKS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeStep === idx;
              return (
                <div
                  key={step.step}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isActive}
                  aria-label={step.title}
                  onMouseEnter={() => setActiveStep(idx)}
                  onFocus={() => setActiveStep(idx)}
                  className={`group relative overflow-hidden rounded-[2rem] flex flex-col justify-between p-7 transition-[flex-grow,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isActive
                      ? "flex-[2.5] bg-card shadow-card"
                      : "flex-[1] bg-background/55 hover:bg-background/80"
                  }`}
                >
                  <div className="flex flex-col h-full z-20">
                    <div className="flex items-center justify-between shrink-0">
                      <h3 className={`font-display font-bold tracking-tight transition-[font-size] duration-300 ${isActive ? "text-2xl" : "text-lg whitespace-nowrap"}`}>
                        {isActive ? step.title : step.short}
                      </h3>
                      {!isActive && (
                        <Icon size={18} strokeWidth={1.75} className="text-foreground/50 shrink-0" />
                      )}
                    </div>

                    <div className={`transition-all duration-500 overflow-hidden ${isActive ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}`}>
                      <p className="text-muted-foreground text-base leading-relaxed max-w-[320px]">{step.desc}</p>
                    </div>

                    <div className="mt-auto">
                      <div className={`relative w-full rounded-2xl overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] origin-bottom ${isActive ? "h-[200px] opacity-100 scale-100" : "h-0 opacity-0 scale-95"}`}>
                        <img src={step.image} alt={step.title} className="w-full h-[200px] object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent z-10" />
                        <span className="absolute bottom-2 right-5 font-display font-normal text-6xl text-white tracking-[-0.01em] tabular-nums z-20">
                          {step.step}
                        </span>
                      </div>

                      <div className={`transition duration-500 ${isActive ? "h-0 opacity-0 overflow-hidden" : "opacity-100 block"}`}>
                        <span className="font-display font-normal text-5xl tracking-[-0.01em] tabular-nums text-foreground/15">
                          {step.step}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      </div>
      </div>

      {/* ─── SELL ON SOCIALS ─── */}
      <section className="py-14 sm:py-16 lg:py-20 border-y border-primary/25 bg-cream relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-12 items-center gap-10 lg:gap-10">
            <div className="lg:col-span-6">
              <p className="mb-6 flex items-center gap-3 text-sm font-medium text-foreground/70">
                <span className="h-px w-8 bg-primary" />
                For WhatsApp, Instagram and TikTok sellers
              </p>
              <h2 className="font-display font-normal text-4xl sm:text-5xl lg:text-[3.5rem] tracking-[-0.01em] leading-[1.02] text-foreground [text-wrap:balance]">
                Sell on your platforms.{" "}
                <span className="font-serif italic font-normal tracking-normal text-[hsl(40_62%_33%)] dark:text-primary">
                  Borrow our trust.
                </span>
              </h2>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-[34rem] [text-wrap:pretty]">
                Buyers ghost at "send to Till" because they can't see who's on the other end. Send a Solely{" "}
                <strong className="font-semibold text-foreground">payment link</strong> instead. They pay into protection,
                you ship, and the money lands with you when they confirm.
              </p>
              <Button
                size="lg"
                asChild
                className="mt-9 rounded-full px-8 h-14 font-semibold text-base shadow-[0_12px_30px_-10px_hsl(var(--primary)/0.6)] hover:bg-primary-hover transition-[transform,background-color] duration-200 active:scale-[0.97]"
              >
                <Link to="/vendor">Start selling free <ArrowRight className="ml-2" size={17} strokeWidth={2} /></Link>
              </Button>
              <p className="mt-4 text-sm text-muted-foreground">
                6% of the product price, only when you sell. The delivery fee is all yours.
              </p>
            </div>

            <ol className="lg:col-span-6 lg:pl-10 relative flex flex-col gap-3 max-w-md lg:max-w-none">
              <span className="absolute left-[2.35rem] lg:left-[4.85rem] top-10 bottom-10 w-px bg-foreground/15" aria-hidden="true" />
              {SELLER_STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li
                    key={s.title}
                    className={`relative flex flex-nowrap items-start gap-4 rounded-2xl bg-card p-4 sm:p-5 shadow-[0_1px_0_hsl(var(--border)),0_18px_40px_-24px_hsl(40_40%_25%/0.35)] ${i === 1 ? "lg:ml-10" : ""}`}
                  >
                    <span className="grid place-items-center w-10 h-10 rounded-xl bg-foreground text-background shrink-0">
                      <Icon size={17} strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{s.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* Anchor for scrolling to shop */}
      <div id="shop-section" className="scroll-mt-20" />

      {/* ─── PILL CATEGORY NAV ─── */}
      <div className="bg-background border-b border-border relative z-20">
        <div className="px-3 sm:container sm:mx-auto sm:px-6">
          <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide py-3">
            {PILL_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                id={`cat-pill-${cat.key}`}
                type="button"
                aria-pressed={activeTab === cat.key}
                onClick={() => {
                  setActiveTab(cat.key);
                  trackCategoryClick(cat.key);
                  if (cat.key !== "all") {
                    navigate(`/shop?category=${cat.key}`);
                  }
                }}
                className={`shrink-0 h-11 sm:h-9 px-4 rounded-full text-sm font-medium border transition-colors duration-150 active:scale-[0.97]
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

      {/* ─── CATEGORY SHOWCASE ─── */}
      <section className="pt-10 pb-6 sm:pt-12 sm:pb-8">
        <div className="mb-7 flex items-end justify-between container mx-auto px-4 sm:px-6">
          <h2 className="font-display font-normal text-2xl sm:text-3xl tracking-[-0.01em]">Shop by category</h2>
          {sectionLink("/shop")}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-4 container mx-auto px-4 sm:px-6">
          {SHOWCASE_CARDS.map((card, i) => (
            <div
              key={card.key}
              className={card.span}
            >
              <Link
                to={`/shop?category=${card.key}`}
                onClick={() => trackCategoryClick(card.key)}
                className="group relative flex overflow-hidden rounded-3xl bg-sunken h-[140px] sm:h-[190px] lg:h-[230px] transition-[transform,box-shadow] duration-300 ease-out hover:shadow-card active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="absolute right-0 top-0 bottom-0 w-[58%] overflow-hidden">
                  <img
                    src={card.image}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-sunken from-[6%] via-sunken/50 via-[32%] to-transparent" />
                </div>

                <div className="relative z-10 p-4 sm:p-6 lg:p-8 flex flex-col justify-end flex-1 max-w-[62%]">
                  <p className="text-[clamp(0.68rem,2.2vw,0.875rem)] text-muted-foreground mb-1 leading-tight">
                    {card.subtitle}
                  </p>
                  <h3 className="font-display font-normal text-[clamp(1rem,3.6vw,1.75rem)] text-foreground tracking-[-0.01em] leading-none break-words hyphens-auto">
                    {card.name}
                  </h3>
                  <span className="mt-3 sm:mt-4 inline-flex items-center gap-1 text-[11px] sm:text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                    Browse <ChevronRight size={15} strokeWidth={1.75} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </div>
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
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="py-8 sm:py-10 bg-cream border-y border-primary/25"
          >
            <div className="container mx-auto px-4 sm:px-6">
              <div className="flex items-end justify-between mb-2">
                <h2 className="font-display font-normal text-2xl sm:text-3xl tracking-[-0.01em]">Picked for you</h2>
                {sectionLink("/shop")}
              </div>
              {reasonChip && (
                <p className="text-sm text-muted-foreground mb-6">{reasonChip}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                {forYouProducts.map(renderProductCard)}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ─── TRENDING PRODUCT GRID ─── */}
      <section className="py-8 sm:py-10">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-7">
            <h2 className="font-display font-normal text-2xl sm:text-3xl tracking-[-0.01em]">Trending now</h2>
            {sectionLink("/shop")}
          </div>

          {productsLoading ? (
            <ProductGridSkeleton count={12} className="xl:grid-cols-6" />
          ) : error ? (
            <ErrorState
              error={error}
              onRetry={fetchProducts}
              compact
              className="bg-background rounded-2xl border border-border shadow-sm"
            />
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-3xl bg-sunken py-16 px-6 text-center">
              <ShoppingBag strokeWidth={1.5} className="h-10 w-10 mx-auto mb-4 text-foreground/25" />
              <p className="font-display font-normal text-lg">Nothing listed here yet</p>
              <p className="text-sm text-muted-foreground mt-1">Sellers in this category can be the first to list.</p>
              <Button className="mt-6 rounded-full active:scale-[0.97]" asChild>
                <Link to="/vendor">Start selling</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredProducts.slice(0, 24).map(renderProductCard)}
            </div>
          )}
        </div>
      </section>

      {/* ─── VENDOR CTA ─── */}
      <section className="pt-4 pb-2 sm:pt-6">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="bg-grain relative overflow-hidden rounded-[2rem] bg-secondary text-secondary-foreground px-6 py-12 sm:p-12 lg:p-16">
            {/* Warm light from the top-right corner */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(60% 80% at 100% 0%, hsl(var(--primary) / 0.22), transparent 70%)" }}
              aria-hidden="true"
            />
            <div className="relative grid lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-6">
                <p className="mb-6 flex items-center gap-3 text-sm font-medium text-secondary-foreground/65">
                  <span className="h-px w-8 bg-primary" />
                  For vendors
                </p>
                <h2 className="font-display font-normal text-4xl sm:text-5xl tracking-[-0.01em] leading-[1.02] [text-wrap:balance]">
                  Stop losing sales{" "}
                  <span className="font-serif italic font-normal tracking-normal text-primary">to mistrust.</span>
                </h2>
                <p className="mt-6 text-secondary-foreground/70 max-w-md text-base sm:text-lg leading-relaxed [text-wrap:pretty]">
                  Your followers want to buy. They just don't trust "send to Till." With a Solely payment link, they
                  pay knowing the money waits with us until the order arrives.
                </p>
              </div>

              <div className="lg:col-span-6 lg:pt-14">
                <ul className="divide-y divide-secondary-foreground/10 border-y border-secondary-foreground/10">
                  {[
                    "No listing or monthly fees. 6% of the product price when you sell",
                    "You keep the full delivery fee",
                    "Your own store page with reviews and ratings",
                    "Live order tracking and a payout dashboard",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 py-3.5 text-sm sm:text-base text-secondary-foreground/85">
                      <Check size={16} strokeWidth={2.25} className="text-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-x-7 gap-y-4 mt-8">
                  {isVendor ? (
                    <Button size="lg" className="h-12 rounded-full px-7 font-semibold hover:bg-primary-hover active:scale-[0.97]" asChild>
                      <Link to="/vendor/dashboard">
                        <LayoutDashboard size={16} strokeWidth={1.75} className="mr-2" /> My dashboard
                      </Link>
                    </Button>
                  ) : (
                    <Button size="lg" className="h-12 rounded-full px-7 font-semibold hover:bg-primary-hover active:scale-[0.97]" asChild>
                      <Link to="/vendor">
                        <Tag size={16} strokeWidth={1.75} className="mr-2" /> Start selling free
                      </Link>
                    </Button>
                  )}
                  <Link
                    to="/how-it-works"
                    className="group inline-flex items-center gap-1 py-3 -my-3 text-sm font-medium text-secondary-foreground/75 hover:text-secondary-foreground transition-colors"
                  >
                    How Solely works
                    <ArrowUpRight size={15} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
