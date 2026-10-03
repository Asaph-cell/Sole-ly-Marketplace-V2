/**
 * A seller's own website, drawn from their settings: a look (fonts, palette,
 * product cards), a hero style, and sections they can reorder or hide. Lives
 * at /store/<store_link> once switched on, and inside the seller's editor as a
 * live preview.
 */
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowUpRight, BadgeCheck, Check, Copy, Instagram, Lock, MapPin, MessageCircle, Phone, Plus, Search,
  ShieldCheck, Sparkles, Star, Truck, X,
} from "lucide-react";
import {
  CONDITION_LABEL, SECTION_LABELS, checkoutPath, ksh, liveOffer, productPath, readableOn, shopName, shopPlace,
  SCALE_FACTOR, socialHandle, socialUrl, timeLeft, whatsappNumber, type HeroStyle, type LiveOffer, type SectionId,
  type ShopProfile, type SiteProduct, type SiteReview, type SiteSettings, type ThemeId,
} from "@/lib/storeSite";
import { expandSizes } from "@/lib/sizes";
import { recordProductView } from "@/lib/productViews";
import { recordSiteEvent } from "@/lib/siteUsage";
import { CORNERS, THEMES, loadThemeFonts, type Palette, type SiteTheme } from "./templates";

// ── Context ────────────────────────────────────────────────────────────────

export interface SiteData {
  profile: ShopProfile;
  products: SiteProduct[];
  reviews: { avg: number; count: number; reviews: SiteReview[] };
}

interface SiteContextValue extends SiteData {
  settings: SiteSettings;
  theme: SiteTheme;
  pal: Palette;
  accent: string;
  onAccent: string;
  name: string;
  /** Path of the website's home: /store/x, or /site-preview/x in the editor. */
  base: string;
  preview: boolean;
  /** Products the hero may show: skips the ones "New in" already shows big. */
  heroProducts: SiteProduct[];
  /** The line under the name, unless About is already showing the same words. */
  heroLine: string | null;
  /** "New in" is on the page (it only appears for shops with 8+ items). */
  featuredShown: boolean;
  /** The seller's offer while it is running. */
  offer: LiveOffer | null;
  /** Button words the seller chose, if any. */
  cta: string | null;
}

const SiteContext = createContext<SiteContextValue | null>(null);
const useSite = () => {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite outside a store website");
  return ctx;
};

// ── Small pieces ───────────────────────────────────────────────────────────

const TikTokIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.77.12V9.77a5.7 5.7 0 0 0-.77-.05A5.68 5.68 0 1 0 15.54 15.4V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48Z" />
  </svg>
);

const Display = ({ as: Tag = "h2", className = "", style, children }: { as?: "h1" | "h2" | "h3" | "p" | "span"; className?: string; style?: CSSProperties; children: ReactNode }) => (
  <Tag className={`sw-display ${className}`} style={style}>{children}</Tag>
);

const Logo = ({ size = 40 }: { size?: number }) => {
  const { profile, name, accent, onAccent, theme } = useSite();
  const r = theme.radius >= 12 ? "50%" : Math.max(theme.radius, 4);
  return profile.store_logo_url ? (
    <img src={profile.store_logo_url} alt="" className="object-cover shrink-0" style={{ width: size, height: size, borderRadius: r }} />
  ) : (
    <span className="sw-display inline-flex items-center justify-center shrink-0" aria-hidden="true"
      style={{ width: size, height: size, borderRadius: r, background: accent, color: onAccent, fontSize: size * 0.5, lineHeight: 1 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
};

const socialsOf = (s: SiteSettings) =>
  [
    { kind: "instagram" as const, label: "Instagram", url: socialUrl("instagram", s.instagram), handle: socialHandle(s.instagram), Icon: Instagram },
    { kind: "tiktok" as const, label: "TikTok", url: socialUrl("tiktok", s.tiktok), handle: socialHandle(s.tiktok), Icon: TikTokIcon },
  ].filter((x) => x.url);

const imageOf = (p?: SiteProduct | null) => p?.images?.find(Boolean) || null;
const isNew = (p: SiteProduct) => Date.now() - new Date(p.created_at).getTime() < 7 * 864e5;

/** Ticks every second while mounted. */
const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};

/** A live countdown: four boxes, or one short run of text when `compact`. */
const Countdown = ({ endsAt, compact, className = "" }: { endsAt: Date; compact?: boolean; className?: string }) => {
  const { theme } = useSite();
  const t = timeLeft(endsAt, useNow());
  if (compact) return <span className="tabular-nums">{t.short}</span>;
  const units: [number, string][] = [[t.d, "days"], [t.h, "hrs"], [t.m, "min"], [t.s, "sec"]];
  return (
    <div className={`flex gap-2 ${className}`} role="timer" aria-label={`Ends in ${t.short}`}>
      {units.map(([v, label]) => (
        <div key={label} className="text-center min-w-[3.6rem] px-2 py-2.5 border"
          style={{ borderRadius: Math.min(theme.radius, 14), borderColor: "color-mix(in srgb, currentColor 28%, transparent)" }}>
          <div className="sw-display text-2xl tabular-nums leading-none">{String(v).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-wider opacity-70 mt-1.5">{label}</div>
        </div>
      ))}
    </div>
  );
};

const PrimaryButton = ({ to, href, children, className = "", disabled, onClick }: { to?: string; href?: string; children: ReactNode; className?: string; disabled?: boolean; onClick?: () => void }) => {
  const cls = `sw-btn inline-flex items-center justify-center gap-2 px-6 h-12 text-[15px] font-semibold ${className}`;
  if (disabled) return <span className={`${cls} opacity-70 cursor-not-allowed`} aria-disabled="true">{children}</span>;
  if (to) return <Link to={to} className={cls} onClick={onClick}>{children}</Link>;
  return <a href={href} className={cls} onClick={onClick}>{children}</a>;
};

const GhostButton = ({ to, href, children, external }: { to?: string; href?: string; children: ReactNode; external?: boolean }) => {
  const cls = "sw-ghost inline-flex items-center justify-center gap-2 px-6 h-12 text-[15px] font-semibold";
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{children}</a>;
};

// ── Product cards ──────────────────────────────────────────────────────────

const CardImage = ({ product, ratio, contain }: { product: SiteProduct; ratio: string; contain?: boolean }) => {
  const [first, second] = (product.images ?? []).filter(Boolean);
  const fit = contain ? "object-contain p-[8%]" : "object-cover";
  return (
    <div className={`relative overflow-hidden ${ratio}`}>
      <img src={first || "/placeholder.svg"} alt={product.name} loading="lazy"
        className={`absolute inset-0 h-full w-full ${fit} transition-opacity duration-300 ${second ? "group-hover:opacity-0" : ""}`} />
      {second && (
        <img src={second} alt="" loading="lazy" aria-hidden="true"
          className={`absolute inset-0 h-full w-full ${fit} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      )}
      {product.stock === 0 && (
        <span className="absolute inset-x-0 bottom-0 py-1.5 text-center text-xs font-semibold bg-black/70 text-white">Sold out</span>
      )}
    </div>
  );
};

const CardBody = ({ product, index = 0, large }: { product: SiteProduct; index?: number; large?: boolean }) => {
  const { theme, base, accent, onAccent } = useSite();
  const to = productPath(base, product);
  const price = ksh(product.price_ksh);
  const cond = product.condition ? CONDITION_LABEL[product.condition] : null;

  switch (theme.card) {
    case "gallery":
      return (
        <Link to={to} className="group block sw-focus">
          <div className="bg-[var(--surface)]" style={{ borderRadius: theme.radius }}>
            <CardImage product={product} ratio="aspect-[4/5]" />
          </div>
          <div className="pt-3 flex items-baseline justify-between gap-3">
            <p className="text-[14px] leading-snug line-clamp-2">{product.name}</p>
            <Display as="span" className={`${large ? "text-2xl" : "text-xl"} shrink-0 italic`}>{price}</Display>
          </div>
        </Link>
      );
    case "tag":
      return (
        <Link to={to} className="group block sw-focus">
          <div className="relative bg-[var(--surface)] border border-[color:var(--line)]" style={{ borderRadius: theme.radius }}>
            <CardImage product={product} ratio="aspect-square" />
            <span className="sw-display absolute left-2.5 top-2.5 px-2.5 py-1 text-[15px] -rotate-3 shadow-sm" style={{ background: accent, color: onAccent, borderRadius: 3 }}>
              {price}
            </span>
          </div>
          <Display as="p" className={`mt-2.5 ${large ? "text-3xl" : "text-xl"} line-clamp-2`}>{product.name}</Display>
        </Link>
      );
    case "peg": {
      const tilt = [-1.6, 1.1, -0.6, 1.4][index % 4];
      return (
        <Link to={to} className="group block sw-focus pt-3">
          <div className="relative bg-[#fffdf8] p-2 pb-3 shadow-[0_10px_24px_-14px_rgba(40,20,40,.55)] transition-transform duration-300 group-hover:rotate-0"
            style={{ transform: `rotate(${tilt}deg)`, borderRadius: 3 }}>
            <span aria-hidden="true" className="absolute left-1/2 -top-3 -translate-x-1/2 h-6 w-2.5 rounded-sm shadow z-10" style={{ background: accent }} />
            <CardImage product={product} ratio="aspect-square" />
            {product.stock === 1 && (
              <span className="absolute top-4 left-4 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: accent, color: onAccent }}>One of one</span>
            )}
            <div className="px-1 pt-2.5 text-[#2a1d2c]">
              <Display as="p" className={`${large ? "text-2xl" : "text-[17px]"} leading-tight line-clamp-2`}>{product.name}</Display>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="font-bold">{price}</span>
                {cond && <span className="opacity-60">{cond}</span>}
              </div>
            </div>
          </div>
        </Link>
      );
    }
    case "spec": {
      const specs = product.specs ? Object.values(product.specs).filter(Boolean).slice(0, 3) : [];
      return (
        <Link to={to} className="group flex flex-col h-full bg-[var(--surface)] border border-[color:var(--line)] overflow-hidden transition-colors hover:border-[color:var(--muted)] sw-focus"
          style={{ borderRadius: theme.radius }}>
          <div className="bg-[var(--bg)] m-2" style={{ borderRadius: Math.max(theme.radius - 6, 4) }}>
            <CardImage product={product} ratio="aspect-square" contain />
          </div>
          <div className="px-3.5 pb-3.5 pt-1.5 flex flex-col gap-2 flex-1">
            {product.brand && <p className="text-xs text-[color:var(--muted)]">{product.brand}</p>}
            <p className={`${large ? "text-lg" : "text-[15px]"} font-medium leading-snug line-clamp-2`}>{product.name}</p>
            {specs.length > 0 && <p className="text-xs text-[color:var(--muted)] line-clamp-1">{specs.join(" / ")}</p>}
            <p className="mt-auto pt-1 text-base font-semibold tabular-nums">{price}</p>
          </div>
        </Link>
      );
    }
    case "editorial":
      return (
        <Link to={to} className="group block sw-focus">
          <div className="relative overflow-hidden bg-[var(--surface)]" style={{ borderRadius: theme.radius }}>
            <CardImage product={product} ratio="aspect-[3/4]" />
            <span className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 text-center text-[11px] tracking-[.24em] uppercase py-3.5"
              style={{ background: "color-mix(in srgb, var(--bg) 94%, transparent)" }}>
              View piece
            </span>
          </div>
          <div className="pt-4 text-center space-y-1.5">
            {(product.brand || cond) && <p className="text-[10px] tracking-[.26em] uppercase text-[color:var(--muted)]">{product.brand || cond}</p>}
            <Display as="p" className={`${large ? "text-3xl" : "text-[22px]"} line-clamp-1`}>{product.name}</Display>
            <p className="text-sm tracking-wide tabular-nums" style={{ color: accent }}>{price}</p>
          </div>
        </Link>
      );
    case "neon": {
      const low = product.stock != null && product.stock > 0 && product.stock <= 3;
      return (
        <Link to={to} className="sw-neon group relative block bg-[var(--surface)] border border-[color:var(--line)] p-2 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 sw-focus"
          style={{ borderRadius: theme.radius + 4 }}>
          <div className="relative overflow-hidden" style={{ borderRadius: theme.radius }}>
            <CardImage product={product} ratio="aspect-square" />
            <span className="absolute left-2 bottom-2 px-2.5 py-1 text-[13px] font-bold tabular-nums" style={{ background: accent, color: onAccent, borderRadius: Math.max(theme.radius - 4, 4) }}>{price}</span>
            {isNew(product) && product.stock !== 0 && (
              <span className="absolute left-2 top-2 text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ background: "var(--bg)", color: "var(--ink)", borderRadius: 6 }}>New</span>
            )}
          </div>
          <div className="px-1.5 pt-3 pb-1.5 flex items-start justify-between gap-2">
            <p className={`${large ? "text-base" : "text-[14px]"} font-medium leading-snug line-clamp-2`}>{product.name}</p>
            {low && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider pt-0.5" style={{ color: accent }}>{product.stock} left</span>}
          </div>
        </Link>
      );
    }
    case "soft":
      return (
        <Link to={to} className="group block p-3 pb-4 bg-[var(--surface)] transition-transform duration-300 hover:-translate-y-1 sw-focus" style={{ borderRadius: theme.radius }}>
          <div className="relative overflow-hidden" style={{ borderRadius: Math.max(theme.radius - 8, 6) }}>
            <CardImage product={product} ratio="aspect-[4/5]" />
            <span className="absolute right-2.5 bottom-2.5 h-10 w-10 rounded-full inline-flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12"
              style={{ background: accent, color: onAccent }} aria-hidden="true">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <div className="px-2 pt-3.5 space-y-2.5">
            <p className={`${large ? "text-lg" : "text-[15px]"} font-semibold leading-snug line-clamp-2`}>{product.name}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 text-sm font-bold rounded-full tabular-nums" style={{ background: `${accent}2b` }}>{price}</span>
              {cond && <span className="text-xs text-[color:var(--muted)]">{cond}</span>}
            </div>
          </div>
        </Link>
      );
    case "plain": {
      const ratios = ["aspect-[3/4]", "aspect-[4/5]", "aspect-square", "aspect-[4/5]", "aspect-[3/4]"];
      return (
        <Link to={to} className="group block sw-focus">
          <div className="overflow-hidden bg-[var(--surface)]" style={{ borderRadius: theme.radius }}>
            <CardImage product={product} ratio={large ? "aspect-[4/5]" : ratios[index % ratios.length]} />
          </div>
          <div className="mt-3 pb-2 flex items-baseline justify-between gap-4 border-b border-transparent group-hover:border-[color:var(--ink)] transition-colors">
            <p className="text-[14px] line-clamp-1">{product.name}</p>
            <span className="text-[14px] tabular-nums text-[color:var(--muted)] shrink-0">{price}</span>
          </div>
        </Link>
      );
    }
    case "deal": {
      const left = product.stock != null && product.stock > 0 && product.stock <= 5;
      return (
        <Link to={to} className="group flex flex-col h-full bg-[var(--surface)] border-2 border-[color:var(--line)] overflow-hidden transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent)] sw-focus"
          style={{ borderRadius: theme.radius }}>
          <CardImage product={product} ratio="aspect-square" />
          <div className="p-3.5 flex flex-col gap-1.5 flex-1">
            <p className={`${large ? "text-base" : "text-[14px]"} font-semibold leading-snug line-clamp-2`}>{product.name}</p>
            <p className="mt-auto pt-1 sw-display text-[26px] leading-none tabular-nums"><span className="text-xs mr-1 opacity-70 font-sans font-bold">KES</span>{Math.round(product.price_ksh).toLocaleString("en-US")}</p>
            {left && (
              <p className="text-xs font-bold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: accent }} aria-hidden="true" /> Only {product.stock} left
              </p>
            )}
            <span className="mt-2 h-10 inline-flex items-center justify-center text-sm font-bold" style={{ background: accent, color: onAccent, borderRadius: 999 }}>Order now</span>
          </div>
        </Link>
      );
    }
    default:
      return (
        <Link to={to} className="group block bg-[var(--surface)] p-2 pb-3 sw-focus transition-transform duration-200 hover:-translate-y-0.5" style={{ borderRadius: theme.radius }}>
          <div className="relative overflow-hidden" style={{ borderRadius: theme.radius - 6 }}>
            <CardImage product={product} ratio="aspect-square" />
            {isNew(product) && product.stock !== 0 && (
              <span className="absolute left-2 top-2 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: accent, color: onAccent }}>New</span>
            )}
          </div>
          <div className="px-1.5 pt-3">
            <p className={`${large ? "text-lg" : "text-[15px]"} font-medium leading-snug line-clamp-2`}>{product.name}</p>
            <p className="mt-1 text-[15px] font-bold">{price}</p>
          </div>
        </Link>
      );
  }
};

/** Any card, with the seller's running offer pinned to the corner. */
const ProductCard = (props: { product: SiteProduct; index?: number; large?: boolean }) => {
  const { offer } = useSite();
  return (
    <div className="relative h-full">
      <CardBody {...props} />
      {offer && props.product.stock !== 0 && (
        <span className="pointer-events-none absolute right-2.5 top-2.5 z-20 inline-flex max-w-[72%] items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm"
          style={{ background: "var(--ink)", color: "var(--bg)", borderRadius: 999 }}>
          <Sparkles size={10} className="shrink-0" aria-hidden="true" /> <span className="truncate">{offer.title}</span>
        </span>
      )}
    </div>
  );
};

// ── Heroes ─────────────────────────────────────────────────────────────────

const fade = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

const HeroCopy = ({ big = "text-[clamp(2.8rem,7vw,5.6rem)]", align = "left" }: { big?: string; align?: "left" | "center" }) => {
  const { name, base, heroLine, settings, cta } = useSite();
  const center = align === "center";
  return (
    <div className={`space-y-5 ${center ? "text-center mx-auto" : ""}`}>
      <motion.div {...fade(0)}><Display as="h1" className={`sw-h ${big}`}>{settings.hero_title || name}</Display></motion.div>
      {heroLine && <motion.p {...fade(1)} className={`text-lg leading-relaxed text-[color:var(--muted)] max-w-[34ch] ${center ? "mx-auto" : ""}`}>{heroLine}</motion.p>}
      <motion.div {...fade(2)} className={`flex flex-wrap gap-3 pt-1 ${center ? "justify-center" : ""}`}>
        <PrimaryButton to={`${base}#products`}>{cta || "Shop now"}</PrimaryButton>
      </motion.div>
    </div>
  );
};

const HeroMosaic = () => {
  const { heroProducts, settings, theme } = useSite();
  const imgs = [settings.banner_url, ...heroProducts.map(imageOf)].filter(Boolean).slice(0, 3) as string[];
  const r = theme.radius;
  return (
    <section className="max-w-6xl mx-auto px-4 pt-10 md:pt-16 grid gap-10 md:grid-cols-12 items-center">
      <div className="md:col-span-5"><HeroCopy /></div>
      {imgs.length > 0 && (
        <motion.div {...fade(2)} className="md:col-span-7 grid grid-cols-3 grid-rows-2 gap-3 h-[320px] sm:h-[440px]">
          <img src={imgs[0]} alt="" className={`h-full w-full object-cover ${imgs.length > 1 ? "col-span-2 row-span-2" : "col-span-3 row-span-2"}`} style={{ borderRadius: r }} />
          {imgs[1] && <img src={imgs[1]} alt="" className={`h-full w-full object-cover ${imgs[2] ? "" : "row-span-2"}`} style={{ borderRadius: r }} />}
          {imgs[2] && <img src={imgs[2]} alt="" className="h-full w-full object-cover" style={{ borderRadius: r }} />}
        </motion.div>
      )}
    </section>
  );
};

const HeroPortrait = () => {
  const { heroProducts, settings } = useSite();
  const img = settings.banner_url || imageOf(heroProducts[0]);
  return (
    <section className="max-w-6xl mx-auto md:px-4 md:pt-10 grid md:grid-cols-12 md:items-end">
      {img && (
        <motion.div {...fade(0)} className="md:col-start-1 md:col-span-7 md:row-start-1">
          <img src={img} alt="" className="w-full aspect-[4/5] md:max-h-[680px] object-cover" />
        </motion.div>
      )}
      <div className={`relative px-4 md:px-0 md:col-start-7 md:col-span-6 md:row-start-1 md:pb-12 md:z-10 ${img ? "-mt-20 md:mt-0 md:-ml-16" : "pt-16"}`}>
        <div className="bg-[var(--bg)] pt-6 pr-4 md:p-10 md:pr-6">
          <HeroCopy big="text-[clamp(3.2rem,7.5vw,6.5rem)] italic" />
        </div>
      </div>
    </section>
  );
};

const HeroType = () => {
  const { heroProducts, settings, name: shop, base, heroLine, cta } = useSite();
  const name = settings.hero_title || shop;
  const imgs = [settings.banner_url, ...heroProducts.map(imageOf)].filter(Boolean).slice(0, 3) as string[];
  const spots = [
    // Tucked along the bottom edge of the letters so the name stays readable.
    { left: "6%", top: "58%", rot: -8, w: "clamp(72px,12vw,150px)" },
    { left: "44%", top: "66%", rot: 4, w: "clamp(72px,11vw,140px)" },
    { left: "80%", top: "52%", rot: 9, w: "clamp(72px,12vw,150px)" },
  ];
  const size = name.length > 14 ? "text-[clamp(3rem,11vw,9rem)]" : "text-[clamp(4rem,16vw,13rem)]";
  return (
    <section className="max-w-6xl mx-auto px-4 pt-8 md:pt-12">
      <div className="relative">
        <Display as="h1" className={`${size} break-words relative z-0`}>{name}</Display>
        {imgs.map((src, i) => (
          <motion.img key={src + i} src={src} alt="" aria-hidden="true"
            initial={{ opacity: 0, scale: 0.85, rotate: 0 }} animate={{ opacity: 1, scale: 1, rotate: spots[i].rot }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.25 + i * 0.12 }}
            className="absolute z-10 aspect-square object-cover border-[5px] border-white shadow-[0_18px_40px_-18px_rgba(0,0,0,.6)] hidden sm:block"
            style={{ left: spots[i].left, top: spots[i].top, width: spots[i].w, borderRadius: 4 }} />
        ))}
      </div>
      <div className="mt-6 sm:mt-20 md:mt-28 grid gap-6 md:grid-cols-2 md:items-end">
        <p className="text-lg text-[color:var(--muted)] max-w-[40ch]">{heroLine}</p>
        <div className="flex gap-3 md:justify-end">
          <PrimaryButton to={`${base}#products`}>{cta || "Shop the drop"}</PrimaryButton>
        </div>
      </div>
      {imgs[0] && (
        <div className="sm:hidden mt-6 grid grid-cols-3 gap-2">
          {imgs.map((src, i) => <img key={i} src={src} alt="" className="aspect-square w-full object-cover" style={{ borderRadius: 4 }} />)}
        </div>
      )}
    </section>
  );
};

const HeroLine = () => {
  const { heroProducts, base, accent } = useSite();
  const hung = heroProducts.filter(imageOf).slice(0, 5);
  const n = hung.length;
  // Spread whatever we have evenly along the line; phones show three.
  const x = (i: number, count: number) => 50 + (i - (count - 1) / 2) * (count > 3 ? 19 : 26);
  // Where the drawn line is at this point across (the SVG below: a curve from
  // y=18 to y=18 through y=110, drawn 96px tall), so each peg sits on it.
  const sag = (pct: number) => { const t = pct / 100; return 0.96 * (18 + 184 * t * (1 - t)) - 6; };
  return (
    <section className="pt-10 md:pt-14 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4"><HeroCopy big="text-[clamp(2.8rem,7vw,5.4rem)]" align="center" /></div>
      {n > 0 && (
        <div className="relative max-w-6xl mx-auto mt-8 h-[290px] sm:h-[350px]">
          <svg className="absolute inset-x-0 top-0 w-full h-24" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M-10 18 Q 500 110 1010 18" fill="none" stroke="currentColor" strokeWidth="2" className="text-[color:var(--muted)]" />
          </svg>
          {hung.map((p, i) => {
            const left = x(i, n);
            const mobileHidden = n > 3 && (i === 0 || i === n - 1);
            return (
              <motion.div key={p.id}
                className={`absolute ${mobileHidden ? "hidden sm:block" : ""}`}
                style={{ left: `${left}%`, top: sag(left), width: "clamp(98px, 16vw, 168px)", marginLeft: "calc(clamp(98px, 16vw, 168px) / -2)", transformOrigin: "50% 0" }}
                initial={{ rotate: i % 2 ? 10 : -10 }} animate={{ rotate: [i % 2 ? 10 : -10, i % 2 ? -3 : 3, i % 2 ? 1.5 : -1.5] }}
                transition={{ duration: 2.4, ease: "easeOut", delay: 0.12 * i }}>
                <span aria-hidden="true" className="absolute left-1/2 -top-2.5 -translate-x-1/2 h-7 w-3 rounded-sm shadow z-10" style={{ background: accent }} />
                <Link to={productPath(base, p)} className="relative block bg-[#fffdf8] p-1.5 pb-7 shadow-[0_14px_28px_-16px_rgba(40,20,40,.6)] sw-focus" aria-label={`${p.name}, ${ksh(p.price_ksh)}`}>
                  <img src={imageOf(p)!} alt="" className="aspect-[4/5] w-full object-cover" />
                  <span className="absolute bottom-1.5 inset-x-0 text-center text-xs font-bold text-[#2a1d2c]">{ksh(p.price_ksh)}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const HeroStage = () => {
  const { heroProducts, base, accent, theme } = useSite();
  const star = heroProducts.find((p) => imageOf(p) && p.stock !== 0) ?? heroProducts[0];
  return (
    <section className="max-w-6xl mx-auto px-4 pt-10 md:pt-16 grid gap-10 md:grid-cols-2 items-center">
      <HeroCopy big="text-[clamp(2.6rem,6vw,4.8rem)]" />
      {star && (
        <motion.div {...fade(2)}>
          <Link to={productPath(base, star)} className="group block sw-focus bg-[var(--surface)] border border-[color:var(--line)] p-6" style={{ borderRadius: theme.radius + 6 }}>
            <div className="relative aspect-[4/3]" style={{ background: `radial-gradient(closest-side, ${accent}38, transparent 78%)` }}>
              <img src={imageOf(star) || "/placeholder.svg"} alt={star.name} className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.04]" />
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-[color:var(--muted)]">{star.brand || "In the spotlight"}</p>
                <p className="font-semibold text-lg leading-snug line-clamp-1">{star.name}</p>
              </div>
              <p className="text-xl font-semibold tabular-nums shrink-0">{ksh(star.price_ksh)}</p>
            </div>
          </Link>
        </motion.div>
      )}
    </section>
  );
};

/** Full-width photo, your name large over its lower edge. */
const HeroFullBleed = () => {
  const { heroProducts, settings, name, base, heroLine, cta } = useSite();
  const img = settings.banner_url || imageOf(heroProducts[0]);
  return (
    <section className="relative isolate overflow-hidden min-h-[560px] h-[82vh] max-h-[860px] flex items-end">
      {img ? (
        <motion.img src={img} alt="" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 2.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 -z-10 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 -z-10 bg-[var(--surface)]" />
      )}
      {img && <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(to top, rgba(10,8,6,.8) 0%, rgba(10,8,6,.3) 46%, rgba(10,8,6,.08) 100%)" }} />}
      <div className={`max-w-6xl w-full mx-auto px-4 pb-14 md:pb-20 ${img ? "text-white" : ""}`}>
        {heroLine && <motion.p {...fade(0)} className="text-[11px] md:text-xs tracking-[.3em] uppercase mb-5 opacity-90 max-w-[48ch]">{heroLine}</motion.p>}
        <motion.div {...fade(1)}><Display as="h1" className="text-[clamp(3.4rem,10vw,9rem)] italic max-w-[14ch]">{settings.hero_title || name}</Display></motion.div>
        <motion.div {...fade(2)} className="mt-8"><PrimaryButton to={`${base}#products`} className="!px-9 tracking-[.18em] uppercase !text-[12px]">{cta || "Discover"}</PrimaryButton></motion.div>
      </div>
    </section>
  );
};

/** The name scrolls across the screen; products and the offer countdown sit below. */
const HeroMarquee = () => {
  const { heroProducts, settings, name, base, heroLine, offer, accent, cta, theme } = useSite();
  const title = settings.hero_title || name;
  const strip = heroProducts.filter(imageOf).slice(0, 8);
  const word = (
    <span className="sw-display text-[clamp(4rem,15vw,12rem)] px-5 shrink-0" style={{ whiteSpace: "nowrap", textWrap: "nowrap" }} aria-hidden="true">
      {title}<span style={{ color: accent }}> ✦ </span>
    </span>
  );
  return (
    <section className="pt-6 md:pt-10 overflow-hidden">
      <h1 className="sr-only">{title}</h1>
      <div className="sw-marquee flex w-max">{word}{word}{word}{word}</div>
      <div className="max-w-6xl mx-auto px-4 mt-6 md:mt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="space-y-4">
          {heroLine && <p className="text-lg text-[color:var(--muted)] max-w-[44ch]">{heroLine}</p>}
          {offer && (
            <div className="inline-flex items-center gap-2.5 px-4 h-10 border text-sm font-semibold" style={{ borderColor: accent, borderRadius: 999 }}>
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: accent }} />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
              </span>
              {offer.title} <span className="opacity-60">·</span> ends in <Countdown endsAt={offer.endsAt} compact />
            </div>
          )}
        </div>
        <PrimaryButton to={`${base}#products`}>{cta || "Shop the drop"}</PrimaryButton>
      </div>
      {strip.length > 0 && (
        <div className="mt-8 md:mt-12 flex gap-3 md:gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] snap-x">
          {strip.map((p, i) => (
            <Link key={p.id} to={productPath(base, p)} className="group relative shrink-0 snap-start w-[44vw] sm:w-[210px] sw-focus" aria-label={`${p.name}, ${ksh(p.price_ksh)}`}>
              <div className="relative overflow-hidden aspect-[3/4] bg-[var(--surface)] border border-[color:var(--line)]" style={{ borderRadius: theme.radius }}>
                <img src={imageOf(p)!} alt="" loading={i > 2 ? "lazy" : "eager"} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute left-2 bottom-2 px-2.5 py-1 text-[12px] font-bold tabular-nums" style={{ background: accent, color: readableOn(accent), borderRadius: 8 }}>{ksh(p.price_ksh)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

/** Photos in arch frames, with a rating badge floating beside them. */
const HeroArch = () => {
  const { heroProducts, settings, reviews, accent, onAccent } = useSite();
  const imgs = [settings.banner_url, ...heroProducts.map(imageOf)].filter(Boolean).slice(0, 2) as string[];
  const arch = "999px 999px 28px 28px";
  return (
    <section className="max-w-6xl mx-auto px-4 pt-10 md:pt-16 grid gap-12 md:grid-cols-12 items-center">
      <div className="md:col-span-6"><HeroCopy big="text-[clamp(2.9rem,7vw,5.8rem)]" /></div>
      {imgs.length > 0 && (
        <motion.div {...fade(2)} className="md:col-span-6 relative flex items-end justify-center gap-4 md:gap-5">
          <img src={imgs[0]} alt="" className={`object-cover ${imgs[1] ? "w-[52%] aspect-[3/4.3]" : "w-[70%] aspect-[3/4.3]"}`} style={{ borderRadius: arch }} />
          {imgs[1] && <img src={imgs[1]} alt="" className="w-[40%] aspect-[3/4] object-cover mb-12" style={{ borderRadius: arch }} />}
          <div className="absolute left-0 md:-left-4 bottom-14 rotate-[-7deg] shadow-lg px-4 py-2.5 text-sm font-bold inline-flex items-center gap-2" style={{ background: accent, color: onAccent, borderRadius: 999 }}>
            {reviews.count > 0 ? <><Star size={15} fill="currentColor" aria-hidden="true" /> {reviews.avg.toFixed(1)} from {reviews.count} {reviews.count === 1 ? "buyer" : "buyers"}</> : <><ShieldCheck size={16} aria-hidden="true" /> Pay safely, M-Pesa</>}
          </div>
        </motion.div>
      )}
    </section>
  );
};

/** Overlapping photos like a magazine spread. */
const HeroCollage = () => {
  const { heroProducts, settings, profile, accent, theme } = useSite();
  const imgs = [settings.banner_url, ...heroProducts.map(imageOf)].filter(Boolean).slice(0, 3) as string[];
  const place = shopPlace(profile);
  const r = theme.radius;
  return (
    <section className="max-w-6xl mx-auto px-4 pt-10 md:pt-16 grid gap-10 md:grid-cols-12 md:items-center">
      <div className="md:col-span-6 space-y-6 md:pr-6">
        {place && <p className="text-xs tracking-[.28em] uppercase text-[color:var(--muted)] inline-flex items-center gap-3"><span className="h-px w-10 inline-block" style={{ background: accent }} aria-hidden="true" /> {place}</p>}
        <HeroCopy big="text-[clamp(3.2rem,8vw,6.8rem)] italic" />
      </div>
      {imgs.length > 0 && (
        <motion.div {...fade(1)} className="md:col-span-6 relative h-[400px] sm:h-[520px] md:h-[600px]">
          <img src={imgs[0]} alt="" className="absolute right-0 top-0 w-[70%] h-[76%] object-cover" style={{ borderRadius: r }} />
          {imgs[1] && <img src={imgs[1]} alt="" className="absolute left-0 bottom-0 w-[46%] h-[50%] object-cover border-[10px] border-[color:var(--bg)]" style={{ borderRadius: r }} />}
          {imgs[2] && <img src={imgs[2]} alt="" className="absolute right-[5%] bottom-[1%] w-[32%] h-[34%] object-cover border-[10px] border-[color:var(--bg)]" style={{ borderRadius: r }} />}
          <span className="absolute left-[4%] top-[6%] text-[11px] tracking-[.26em] uppercase [writing-mode:vertical-rl] rotate-180 text-[color:var(--muted)]">New arrivals</span>
        </motion.div>
      )}
    </section>
  );
};

/** A poster in the accent colour: the offer (or the name) huge, products popping up from the bottom. */
const HeroBanner = () => {
  const { heroProducts, settings, offer, name, base, heroLine, accent, onAccent, theme, cta } = useSite();
  const shelf = heroProducts.filter(imageOf).slice(0, 4);
  const lefts = ["0%", "24%", "48%", "70%"];
  const lifts = ["-4%", "10%", "-12%", "6%"];
  const rot = [-5, 4, -3, 6];
  return (
    <section className="max-w-6xl mx-auto px-4 pt-6 md:pt-10">
      <div className="relative overflow-hidden px-6 pt-10 md:px-12 md:pt-14" style={{ background: accent, color: onAccent, borderRadius: theme.radius + 10 }}>
        <span aria-hidden="true" className="absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-[.12]" style={{ background: onAccent }} />
        <div className="relative grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7 pb-8 md:pb-14 space-y-5">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] px-3.5 py-1.5" style={{ background: onAccent, color: accent, borderRadius: 999 }}>
              <Sparkles size={13} aria-hidden="true" /> {offer ? "Offer on now" : name}
            </p>
            <motion.div {...fade(0)}><Display as="h1" className="text-[clamp(2.4rem,5.4vw,4.8rem)]">{settings.hero_title || offer?.title || name}</Display></motion.div>
            {(offer?.text || heroLine) && <p className="text-lg max-w-[40ch] opacity-90">{offer?.text || heroLine}</p>}
            {offer && <Countdown endsAt={offer.endsAt} />}
            <Link to={`${base}#products`} className="inline-flex items-center justify-center gap-2 px-7 h-12 text-[15px] font-bold transition-transform active:scale-[.98]" style={{ background: onAccent, color: accent, borderRadius: 999 }}>
              {cta || "Shop the deals"} <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
          {shelf.length > 0 && (
            <div className="md:col-span-5 relative h-[220px] sm:h-[300px] md:h-[400px]" aria-hidden="true">
              {shelf.map((p, i) => (
                <motion.img key={p.id} src={imageOf(p)!} alt=""
                  initial={{ y: 80, opacity: 0, rotate: 0 }} animate={{ y: 0, opacity: 1, rotate: rot[i] }}
                  transition={{ type: "spring", stiffness: 180, damping: 17, delay: 0.2 + i * 0.1 }}
                  className="absolute aspect-square w-[40%] object-cover border-[5px] border-white shadow-[0_18px_36px_-16px_rgba(0,0,0,.55)]"
                  style={{ left: lefts[i], bottom: lifts[i], borderRadius: 14 }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const HEROES: Record<HeroStyle, () => JSX.Element> = {
  mosaic: HeroMosaic, portrait: HeroPortrait, type: HeroType, line: HeroLine, stage: HeroStage,
  fullbleed: HeroFullBleed, marquee: HeroMarquee, arch: HeroArch, collage: HeroCollage, banner: HeroBanner,
};

// ── Sections ───────────────────────────────────────────────────────────────

const SectionHead = ({ title, aside }: { title: string; aside?: ReactNode }) => (
  <div className="flex items-end justify-between gap-4 mb-6 md:mb-8">
    <Display className="sw-h text-[clamp(1.6rem,3vw,2.3rem)]">{title}</Display>
    {aside}
  </div>
);

const OfferBanner = () => {
  const { offer, accent, onAccent, theme, base } = useSite();
  if (!offer) return null;
  return (
    <section id="offer" className="max-w-6xl mx-auto px-4 scroll-mt-24">
      <div className="relative overflow-hidden px-6 py-10 md:px-14 md:py-14 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center"
        style={{ background: accent, color: onAccent, borderRadius: theme.radius + 4 }}>
        <span aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-[.14]" style={{ background: onAccent }} />
        <span aria-hidden="true" className="absolute right-28 -bottom-32 h-64 w-64 rounded-full opacity-[.1]" style={{ background: onAccent }} />
        <div className="relative space-y-3">
          <p className="text-xs font-bold uppercase tracking-[.18em] opacity-85 inline-flex items-center gap-2"><Sparkles size={14} aria-hidden="true" /> Offer on now</p>
          <Display className="text-[clamp(1.9rem,4.2vw,3rem)]">{offer.title}</Display>
          {offer.text && <p className="text-lg opacity-90 max-w-[46ch] leading-relaxed">{offer.text}</p>}
        </div>
        <div className="relative space-y-4 md:justify-self-end">
          <p className="text-sm font-semibold opacity-85">Ends in</p>
          <Countdown endsAt={offer.endsAt} />
          <Link to={`${base}#products`} className="inline-flex items-center justify-center gap-2 px-7 h-12 text-[15px] font-bold transition-transform active:scale-[.98]"
            style={{ background: onAccent, color: accent, borderRadius: theme.radius <= 4 ? theme.radius : 999 }}>
            Shop now <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
};

const Perks = () => {
  const { profile, name, reviews, theme, accent } = useSite();
  const place = shopPlace(profile);
  const items = [
    { Icon: ShieldCheck, title: "Pay safely", text: "M-Pesa through Solely. Your money is held until your order arrives." },
    { Icon: Truck, title: place ? `Delivery from ${place}` : "Delivery to you", text: `${name} delivers. You agree the fee before you pay.` },
    reviews.count > 0
      ? { Icon: Star, title: `${reviews.avg.toFixed(1)} from ${reviews.count} ${reviews.count === 1 ? "buyer" : "buyers"}`, text: "Reviews come only from people who bought." }
      : profile.kyc_status === "approved"
        ? { Icon: BadgeCheck, title: "Verified seller", text: "Solely has checked this seller's identity." }
        : null,
    profile.store_phone ? { Icon: MessageCircle, title: "Ask before you buy", text: `Call or message ${name} with any question.` } : null,
  ].filter(Boolean) as { Icon: typeof Star; title: string; text: string }[];
  return (
    <section className="max-w-6xl mx-auto px-4">
      <ul className="grid gap-px sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))] overflow-hidden border border-[color:var(--line)] bg-[color:var(--line)]" style={{ borderRadius: theme.radius }}>
        {items.map(({ Icon, title, text }) => (
          <li key={title} className="bg-[var(--surface)] p-5 md:p-6 flex gap-4">
            <span className="h-11 w-11 shrink-0 inline-flex items-center justify-center" style={{ background: `${accent}22`, color: accent, borderRadius: Math.min(theme.radius, 14) }}>
              <Icon size={21} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold leading-snug">{title}</p>
              <p className="text-sm text-[color:var(--muted)] mt-1 leading-relaxed">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

const GALLERY_TITLE: Partial<Record<ThemeId, string>> = { maison: "Lookbook", atlas: "Inspiration", street: "On the street", mitumba: "Fresh finds", bloom: "Little moments" };

const Gallery = () => {
  const { settings, theme } = useSite();
  const photos = settings.gallery.filter(Boolean).slice(0, 8);
  if (!photos.length) return null;
  return (
    <section className="max-w-6xl mx-auto px-4">
      <SectionHead title={GALLERY_TITLE[theme.id] ?? "Gallery"} />
      <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[150px] sm:auto-rows-[200px] md:auto-rows-[230px] gap-3 md:gap-4">
        {photos.map((src, i) => (
          <img key={src + i} src={src} alt="" loading="lazy"
            className={`h-full w-full object-cover ${i === 0 ? "col-span-2 row-span-2" : i === 4 && photos.length > 5 ? "md:col-span-2" : ""}`}
            style={{ borderRadius: theme.radius }} />
        ))}
      </div>
    </section>
  );
};

const Faqs = () => {
  const { settings, theme, accent } = useSite();
  if (!settings.faqs.length) return null;
  return (
    <section className="max-w-3xl mx-auto px-4">
      <SectionHead title="Good to know" />
      <div className="border-t border-[color:var(--line)]">
        {settings.faqs.map((f, i) => (
          <details key={i} className="group border-b border-[color:var(--line)]">
            <summary className="flex items-center justify-between gap-6 py-5 cursor-pointer list-none font-semibold text-[17px] sw-focus [&::-webkit-details-marker]:hidden" style={{ borderRadius: theme.radius }}>
              {f.q}
              <span className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full transition-transform duration-300 group-open:rotate-45" style={{ background: `${accent}26` }} aria-hidden="true"><Plus size={17} /></span>
            </summary>
            <p className="pb-6 pr-12 leading-relaxed text-[color:var(--muted)] whitespace-pre-line">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
};

const Featured = () => {
  const { products, theme, featuredShown } = useSite();
  if (!featuredShown) return null;
  const picks = products.filter((p) => p.stock !== 0).slice(0, 5);
  const [lead, ...rest] = picks;
  return (
    <section className="max-w-6xl mx-auto px-4">
      <SectionHead title={theme.id === "street" ? "Just dropped" : "New in"} />
      <div className="grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-4 items-start">
        <div className="col-span-2 md:row-span-2"><ProductCard product={lead} large /></div>
        {rest.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i + 1} />)}
      </div>
    </section>
  );
};

const Categories = ({ onPick }: { onPick: (c: string) => void }) => {
  const { products, theme } = useSite();
  const cats = useMemo(() => {
    const map = new Map<string, { count: number; img: string | null }>();
    products.forEach((p) => {
      if (!p.category) return;
      const cur = map.get(p.category) ?? { count: 0, img: null };
      map.set(p.category, { count: cur.count + 1, img: cur.img || imageOf(p) });
    });
    return Array.from(map.entries());
  }, [products]);
  if (cats.length < 2) return null;
  return (
    <section className="max-w-6xl mx-auto px-4">
      <SectionHead title="Shop by category" />
      <div className="flex md:grid md:grid-cols-4 gap-3 md:gap-4 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1 snap-x [scrollbar-width:none]">
        {cats.map(([cat, { count, img }]) => (
          <a key={cat} href="#products" onClick={() => onPick(cat)}
            className="group relative shrink-0 w-[62%] sm:w-[40%] md:w-auto aspect-[4/5] overflow-hidden snap-start bg-[var(--surface)] sw-focus" style={{ borderRadius: theme.radius }}>
            {img && <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span className="absolute left-4 bottom-4 right-4 text-white">
              <span className="sw-display block text-2xl capitalize">{cat.replace(/_/g, " ")}</span>
              <span className="text-sm opacity-85">{count} {count === 1 ? "item" : "items"}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};

type Sort = "new" | "low" | "high";

const PRODUCTS_TITLE: Partial<Record<ThemeId, string>> = {
  mitumba: "On the rail", maison: "The collection", atlas: "The collection", pulse: "Shop the drops", bloom: "Shop all", souk: "Fresh stock",
};

const AllProducts = ({ category, setCategory, tilesShown }: { category: string; setCategory: (c: string) => void; tilesShown: boolean }) => {
  const { products, theme, accent, onAccent, settings } = useSite();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const cats = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[], [products]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => (category === "all" || p.category === category) && (!q || `${p.name} ${p.brand ?? ""}`.toLowerCase().includes(q)));
    if (sort === "low") return [...list].sort((a, b) => a.price_ksh - b.price_ksh);
    if (sort === "high") return [...list].sort((a, b) => b.price_ksh - a.price_ksh);
    return list;
  }, [products, category, query, sort]);

  // The seller can pick 3 or 4 across; otherwise each card style has its own rhythm.
  const wide = settings.grid_cols === 3 ? "lg:grid-cols-3" : settings.grid_cols === 4 ? "lg:grid-cols-4" : null;
  const masonry = theme.card === "plain";
  const cols = masonry
    ? `columns-2 ${settings.grid_cols === 4 ? "lg:columns-4" : "md:columns-3"} gap-x-4 md:gap-x-6`
    : theme.card === "gallery" || theme.card === "editorial"
      ? `grid-cols-2 md:grid-cols-3 ${wide ?? ""} gap-x-4 gap-y-10 md:gap-x-8`
      : theme.card === "peg"
        ? `grid-cols-2 sm:grid-cols-3 ${wide ?? "lg:grid-cols-4"} gap-x-5 gap-y-8`
        : `grid-cols-2 sm:grid-cols-3 ${wide ?? "lg:grid-cols-4"} gap-3 md:gap-5`;
  const pill = theme.radius <= 4 ? theme.radius : 999;
  const title = PRODUCTS_TITLE[theme.id] ?? "Shop everything";

  return (
    <section id="products" className="max-w-6xl mx-auto px-4 scroll-mt-24">
      <SectionHead title={title}
        aside={<span className="text-sm text-[color:var(--muted)] pb-2">{products.length} {products.length === 1 ? "item" : "items"}</span>} />

      {((cats.length > 1 && !tilesShown) || products.length > 8 || category !== "all") && (
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-6">
          {/* With category tiles on the page, a tapped tile shows here as a
              removable filter instead of a second row of category buttons. */}
          {tilesShown && category !== "all" ? (
            <button type="button" onClick={() => setCategory("all")} className="self-start h-10 px-4 text-sm font-medium border inline-flex items-center gap-2 capitalize sw-focus"
              style={{ borderRadius: pill, borderColor: accent, background: accent, color: onAccent }}>
              {category.replace(/_/g, " ")} <X size={14} aria-hidden="true" /><span className="sr-only">Show all products</span>
            </button>
          ) : cats.length > 1 && !tilesShown ? (
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none]">
              {["all", ...cats].map((c) => {
                const on = c === category;
                return (
                  <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={on}
                    className="h-10 px-4 text-sm font-medium border whitespace-nowrap capitalize sw-focus transition-colors"
                    style={{ borderRadius: pill, borderColor: on ? accent : "var(--line)", background: on ? accent : "transparent", color: on ? onAccent : "var(--ink)" }}>
                    {c === "all" ? "All" : c.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          ) : <span />}
          {products.length > 8 && (
            <div className="flex gap-2">
              <label className="relative flex-1 md:w-60">
                <span className="sr-only">Search this shop</span>
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
                  className="w-full h-10 pl-9 pr-3 text-sm bg-[var(--surface)] border border-[color:var(--line)] outline-none sw-focus" style={{ borderRadius: pill }} />
              </label>
              <label>
                <span className="sr-only">Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-10 px-3 text-sm bg-[var(--surface)] border border-[color:var(--line)] sw-focus" style={{ borderRadius: pill }}>
                  <option value="new">Newest</option>
                  <option value="low">Lowest price</option>
                  <option value="high">Highest price</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-16 text-center text-[color:var(--muted)] border border-dashed border-[color:var(--line)]" style={{ borderRadius: theme.radius }}>
          {products.length === 0 ? "New stock is on the way. Check back soon." : "Nothing here matches. Try another word."}
        </p>
      ) : (
        <div className={masonry ? cols : `grid ${cols}`}>
          {shown.map((p, i) => masonry
            ? <div key={p.id} className="mb-8 break-inside-avoid"><ProductCard product={p} index={i} /></div>
            : <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      )}
    </section>
  );
};

const Stars = ({ value, size = 16 }: { value: number; size?: number }) => (
  <span className="inline-flex gap-0.5" role="img" aria-label={`${value.toFixed(1)} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={size} aria-hidden="true" fill={i <= Math.round(value) ? "currentColor" : "none"} strokeWidth={1.6} />
    ))}
  </span>
);

const Reviews = () => {
  const { reviews, accent, theme } = useSite();
  if (!reviews.count) return null;
  return (
    <section className="max-w-6xl mx-auto px-4">
      <div className="grid gap-8 md:grid-cols-12">
        <div className="md:col-span-4 space-y-3">
          <Display className="sw-h text-[clamp(1.6rem,3vw,2.3rem)]">What buyers say</Display>
          <div className="flex items-center gap-3">
            <Display as="span" className="text-4xl">{reviews.avg.toFixed(1)}</Display>
            <div>
              <span style={{ color: accent }}><Stars value={reviews.avg} size={18} /></span>
              <p className="text-sm text-[color:var(--muted)] mt-1">from {reviews.count} {reviews.count === 1 ? "buyer" : "buyers"}</p>
            </div>
          </div>
        </div>
        {reviews.reviews.length > 0 && (
          <div className="md:col-span-8 columns-1 sm:columns-2 gap-4 space-y-4">
            {reviews.reviews.map((r) => (
              <figure key={r.id} className="break-inside-avoid bg-[var(--surface)] border border-[color:var(--line)] p-5" style={{ borderRadius: theme.radius }}>
                <span style={{ color: accent }}><Stars value={r.rating} size={14} /></span>
                <blockquote className="mt-3 leading-relaxed">{r.review}</blockquote>
                <figcaption className="mt-3 text-xs text-[color:var(--muted)]">
                  Verified buyer, {new Date(r.created_at).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const About = () => {
  const { settings, profile, name, products, theme, accent } = useSite();
  const text = settings.about || profile.store_description;
  // The oldest item's photo: the hero and "New in" use the newest ones.
  const img = products.length > 3 ? imageOf([...products].reverse().find(imageOf)) : null;
  const place = shopPlace(profile);
  const socials = socialsOf(settings);
  return (
    <section id="about" className="max-w-6xl mx-auto px-4 scroll-mt-24">
      <div className={`grid gap-8 md:gap-12 items-center bg-[var(--surface)] p-5 md:p-10 ${img ? "md:grid-cols-2" : ""}`} style={{ borderRadius: theme.radius + 4 }}>
        {img && <img src={img} alt="" loading="lazy" className="w-full aspect-[5/4] object-cover order-last md:order-first" style={{ borderRadius: theme.radius }} />}
        <div className="space-y-5">
          <Display className="sw-h text-[clamp(1.6rem,3vw,2.3rem)]">About {name}</Display>
          {text && <p className="leading-relaxed whitespace-pre-line max-w-[60ch]">{text}</p>}
          <ul className="space-y-2.5 text-[15px]">
            {place && <li className="flex items-center gap-2.5"><MapPin size={17} style={{ color: accent }} aria-hidden="true" /> Based in {place}</li>}
            {profile.kyc_status === "approved" && <li className="flex items-center gap-2.5"><BadgeCheck size={17} style={{ color: accent }} aria-hidden="true" /> Verified seller</li>}
            {profile.store_phone && (
              <li><a href={`tel:${profile.store_phone}`} className="inline-flex items-center gap-2.5 underline underline-offset-4 sw-focus"><Phone size={17} style={{ color: accent }} aria-hidden="true" /> {profile.store_phone}</a></li>
            )}
          </ul>
          {socials.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-1">
              {socials.map(({ label, url, handle, Icon }) => (
                <GhostButton key={label} href={url!} external><Icon size={17} /> {handle}<span className="sr-only"> on {label}</span></GhostButton>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// ── Shell ──────────────────────────────────────────────────────────────────

const Shell = ({ children, productPage }: { children: ReactNode; productPage?: boolean }) => {
  const { settings, theme, pal, accent, onAccent, name, base, preview, offer, profile } = useSite();
  const wa = whatsappNumber(profile.store_phone);
  const centered = theme.id === "maison" || theme.id === "atlas";
  // The seller's type choices win over the look's own.
  const validHex = (c: string | null) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : null);
  const ink = validHex(settings.text_color) ?? pal.ink;
  const muted = settings.text_color ? `color-mix(in srgb, ${ink} 62%, ${pal.bg})` : pal.muted;
  const headingColor = validHex(settings.heading_color);
  const headingScale = settings.heading_scale ? SCALE_FACTOR[settings.heading_scale] : 1;
  const textScale = settings.text_scale ? SCALE_FACTOR[settings.text_scale] : 1;
  const headingWeight = settings.heading_weight === "bold" ? 700 : settings.heading_weight === "regular" ? 400 : theme.displayWeight;
  const vars = {
    "--bg": pal.bg, "--surface": pal.surface, "--ink": ink, "--muted": muted, "--line": pal.line,
    "--accent": accent, "--on-accent": onAccent,
    background: pal.bg, color: ink, fontFamily: theme.body, colorScheme: pal.dark ? "dark" : "light",
  } as CSSProperties;
  const d = theme.displayStyle ?? {};
  const pill = theme.radius <= 4 ? theme.radius : 999;
  const socials = socialsOf(settings);

  return (
    <div data-layout="designed" className="min-h-screen flex flex-col antialiased text-[16px]" style={vars}>
      <style>{`
        .sw-display { zoom: ${headingScale}; font-family: ${theme.display}; font-weight: ${headingWeight}; letter-spacing: ${d.letterSpacing ?? "normal"}; line-height: ${d.lineHeight ?? 1.05}; ${d.textTransform ? `text-transform: ${d.textTransform};` : ""} text-wrap: balance; overflow-wrap: normal; word-break: normal; hyphens: none; }
        .sw-btn { background: var(--accent); color: var(--on-accent); border-radius: ${pill}px; transition: filter .15s ease, transform .1s ease; }
        .sw-btn:hover { filter: brightness(1.07); }
        .sw-btn:active { transform: scale(.98); }
        .sw-ghost { border: 1.5px solid var(--line); color: var(--ink); border-radius: ${pill}px; transition: border-color .15s ease; }
        .sw-ghost:hover { border-color: var(--ink); }
        .sw-focus:focus-visible, .sw-btn:focus-visible, .sw-ghost:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
        ${headingColor ? `.sw-h { color: ${headingColor}; }` : ""}
        ${textScale !== 1 ? `.sw-body { zoom: ${textScale}; }` : ""}
        .sw-neon:hover { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 20px 46px -20px var(--accent); }
        @keyframes sw-scroll { to { transform: translateX(-50%); } }
        .sw-marquee { animation: sw-scroll 32s linear infinite; }
        .sw-marquee:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .sw-marquee { animation: none; } }
      `}</style>

      {settings.announcement && (
        <p className="text-center text-sm font-semibold px-4 py-2.5" style={{ background: accent, color: onAccent }}>{settings.announcement}</p>
      )}

      <header className="sticky top-0 z-30 border-b border-[color:var(--line)]" style={{ background: "color-mix(in srgb, var(--bg) 96%, transparent)" }}>
        <div className={`max-w-6xl mx-auto px-4 h-16 flex items-center gap-3 ${centered ? "justify-center md:grid md:grid-cols-3" : "justify-between"}`}>
          {centered && (
            <nav className="hidden md:flex items-center gap-6 text-[11px] tracking-[.22em] uppercase font-medium" aria-label="Shop">
              <Link to={`${base}#products`} className="hover:opacity-60 transition-opacity sw-focus">Shop</Link>
              {offer && <Link to={`${base}#offer`} className="hover:opacity-60 transition-opacity sw-focus" style={{ color: accent }}>Offer</Link>}
              <Link to={`${base}#about`} className="hover:opacity-60 transition-opacity sw-focus">About</Link>
            </nav>
          )}
          <Link to={base} className={`flex items-center gap-3 min-w-0 sw-focus ${centered ? "md:justify-center" : ""}`}>
            {!centered && <Logo size={38} />}
            <Display as="span" className={`${centered ? "text-2xl md:text-3xl tracking-[.02em]" : "text-xl md:text-2xl"} truncate`} style={{ lineHeight: 1.1 }}>{name}</Display>
          </Link>
          <nav className={`flex items-center gap-1 shrink-0 text-[15px] font-medium ${centered ? "md:justify-end md:ml-auto" : ""}`} aria-label={centered ? "Social and shop" : "Shop"}>
            <Link to={`${base}#products`} className={`px-2.5 py-2 hover:underline underline-offset-4 sw-focus ${centered ? "md:hidden" : ""}`}>Shop</Link>
            {offer && !centered && (
              <Link to={`${base}#offer`} className="px-2.5 py-2 hover:underline underline-offset-4 sw-focus font-semibold" style={{ color: accent }}>Offer</Link>
            )}
            <Link to={`${base}#about`} className={`px-2.5 py-2 hover:underline underline-offset-4 sw-focus ${centered ? "md:hidden" : ""}`}>About</Link>
            {socials.map(({ label, url, Icon }) => (
              <a key={label} href={url!} target="_blank" rel="noopener noreferrer" aria-label={label}
                className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--surface)] sw-focus">
                <Icon size={19} />
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="sw-body flex-1 pb-20">{children}</main>

      <footer className="sw-body bg-[var(--surface)] border-t border-[color:var(--line)]">
        <div className="max-w-6xl mx-auto px-4 py-12 grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3"><Logo size={34} /><Display as="span" className="text-2xl">{name}</Display></div>
          </div>
          {/* On product pages this note already sits beside the Buy button. */}
          {!productPage && <div className="md:col-span-7 md:pl-8 space-y-3 text-[15px]">
            <p className="font-semibold flex items-center gap-2"><ShieldCheck size={18} style={{ color: accent }} aria-hidden="true" /> Your money is safe here</p>
            <p className="text-[color:var(--muted)] leading-relaxed max-w-[58ch]">
              You pay with M-Pesa through Solely. Solely holds the money and only pays {name} after your order arrives. If it never comes, you get a full refund.
            </p>
            <Link to="/how-it-works" className="inline-block underline underline-offset-4 sw-focus">How buyer protection works</Link>
          </div>}
        </div>
        <div className="border-t border-[color:var(--line)]">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row gap-2 items-center justify-between text-[13px] text-[color:var(--muted)]">
            <span>© {new Date().getFullYear()} {name}</span>
            <Link to="/" className="hover:text-[color:var(--ink)] sw-focus">Powered by Solely</Link>
          </div>
        </div>
      </footer>

      {settings.whatsapp_button && wa && (
        <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${name}, I'm on your Solely website.`)}`} target="_blank" rel="noopener noreferrer"
          aria-label={`Chat with ${name} on WhatsApp`} onClick={() => { if (!preview) recordSiteEvent(profile.id, "whatsapp_click"); }}
          className="fixed bottom-5 right-4 z-40 h-14 w-14 rounded-full inline-flex items-center justify-center shadow-[0_12px_30px_-8px_rgba(0,0,0,.5)] transition-transform hover:scale-105 active:scale-95 sw-focus"
          style={{ background: "#25D366", color: "#fff" }}>
          <MessageCircle size={26} aria-hidden="true" />
        </a>
      )}

      {preview && (
        <span className="fixed bottom-3 left-3 z-50 text-xs font-medium px-3 py-1.5 rounded-full bg-black/80 text-white pointer-events-none">
          Preview: buy buttons are off
        </span>
      )}
    </div>
  );
};

// ── Pages ──────────────────────────────────────────────────────────────────

const SiteHome = () => {
  const { settings, theme, products, profile, preview } = useSite();
  const [category, setCategory] = useState("all");
  const { hash } = useLocation();

  // One count per visitor per half hour, never from the seller's own editor.
  useEffect(() => {
    if (!preview) recordSiteEvent(profile.id, "visit");
  }, [preview, profile.id]);

  // "Shop" / "About" in the header link here with a #section.
  useEffect(() => {
    if (hash) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }));
  }, [hash]);

  const heroId = settings.hero_style ?? theme.hero;
  const Hero = HEROES[heroId] ?? HeroMosaic;
  const tilesShown = settings.sections.some((s) => s.id === "categories" && s.visible)
    && new Set(products.map((p) => p.category).filter(Boolean)).size > 1;
  const render: Record<SectionId, ReactNode> = {
    // The poster banner and the scrolling-name hero already show the offer.
    offer: heroId === "banner" ? null : <OfferBanner />,
    featured: <Featured />,
    categories: <Categories onPick={setCategory} />,
    products: <AllProducts category={category} setCategory={setCategory} tilesShown={tilesShown} />,
    perks: <Perks />,
    gallery: <Gallery />,
    reviews: <Reviews />,
    faq: <Faqs />,
    about: <About />,
  };

  return (
    <div className="space-y-20 md:space-y-28">
      <Hero />
      {settings.sections.filter((s) => s.visible && s.id in SECTION_LABELS && render[s.id]).map((s) => (
        <div key={s.id}>{render[s.id]}</div>
      ))}
    </div>
  );
};

const SiteProductPage = ({ productRef }: { productRef: string }) => {
  const { products, theme, accent, base, preview, name, offer, profile } = useSite();
  const product = products.find((p) => p.id === productRef || p.short_code === productRef.toUpperCase());
  const [imageIndex, setImageIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setImageIndex(0);
    window.scrollTo(0, 0);
    if (product && !preview) recordProductView(product.id, "own_site");
  }, [product?.id, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-5">
        <Display as="h1" className="text-4xl">This item has sold</Display>
        <p className="text-[color:var(--muted)]">Have a look at what's still in stock.</p>
        <PrimaryButton to={base}><ArrowLeft size={16} aria-hidden="true" /> Back to the shop</PrimaryButton>
      </div>
    );
  }

  const images = product.images?.filter(Boolean).length ? product.images.filter(Boolean) : ["/placeholder.svg"];
  const sizes = expandSizes(product.sizes).filter(Boolean);
  const colors = (product.colors ?? []).filter(Boolean);
  const specs = product.specs ? Object.entries(product.specs).filter(([, v]) => v) : [];
  const cond = product.condition ? CONDITION_LABEL[product.condition] : null;
  const soldOut = product.stock === 0;
  const more = products.filter((p) => p.id !== product.id).slice(0, 4);
  const contain = theme.card === "spec";
  const chip = theme.radius <= 4 ? theme.radius : 10;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* closed the share sheet */ }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6">
      <Helmet>
        <title>{`${product.name} | ${name}`}</title>
        <meta name="description" content={(product.description || `${product.name} for ${ksh(product.price_ksh)} from ${name}.`).slice(0, 160)} />
        <meta property="og:title" content={`${product.name}, ${ksh(product.price_ksh)}`} />
        <meta property="og:image" content={images[0]} />
      </Helmet>

      <Link to={base} className="inline-flex items-center gap-1.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--ink)] mb-6 sw-focus">
        <ArrowLeft size={16} aria-hidden="true" /> All products
      </Link>

      <div className="grid gap-8 md:gap-14 md:grid-cols-12">
        <div className="md:col-span-7 space-y-3">
          <div className={`overflow-hidden bg-[var(--surface)] ${contain ? "border border-[color:var(--line)]" : ""}`} style={{ borderRadius: theme.radius }}>
            <img src={images[imageIndex]} alt={product.name} className={`w-full aspect-square ${contain ? "object-contain p-8" : "object-cover"}`} />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {images.map((src, i) => (
                <button key={src + i} type="button" onClick={() => setImageIndex(i)} aria-label={`Photo ${i + 1}`} aria-pressed={i === imageIndex}
                  className="shrink-0 h-[72px] w-[72px] overflow-hidden border-2 sw-focus"
                  style={{ borderColor: i === imageIndex ? accent : "transparent", borderRadius: chip }}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-5 space-y-7 md:sticky md:top-24 md:self-start">
          <div className="space-y-3">
            {(product.brand || cond) && <p className="text-sm text-[color:var(--muted)]">{[product.brand, cond].filter(Boolean).join(", ")}</p>}
            <Display as="h1" className="sw-h text-[clamp(1.7rem,3.4vw,2.5rem)]">{product.name}</Display>
            <p className="text-2xl font-semibold tabular-nums">{ksh(product.price_ksh)}</p>
            {offer && !soldOut && (
              <p className="flex items-center gap-2 text-sm font-semibold px-3.5 py-2.5" style={{ background: `${accent}26`, borderRadius: chip }}>
                <Sparkles size={15} style={{ color: accent }} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{offer.title}</span>
                <span className="ml-auto shrink-0 font-normal text-[color:var(--muted)]"><Countdown endsAt={offer.endsAt} compact /> left</span>
              </p>
            )}
          </div>

          {sizes.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-sm font-semibold">Sizes available</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <span key={s} className="min-w-[44px] h-11 px-3 inline-flex items-center justify-center text-sm border border-[color:var(--line)]" style={{ borderRadius: chip }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {colors.length > 0 && <p className="text-[15px]"><span className="font-semibold">Colours: </span><span className="text-[color:var(--muted)]">{colors.join(", ")}</span></p>}

          <div className="space-y-3">
            {soldOut ? (
              <span className="sw-ghost w-full h-14 inline-flex items-center justify-center font-semibold opacity-60">Sold out</span>
            ) : (
              <PrimaryButton to={checkoutPath(product)} disabled={preview} className="w-full h-14 text-base" onClick={() => recordSiteEvent(profile.id, "buy_click")}>
                <Lock size={17} aria-hidden="true" /> Buy securely
              </PrimaryButton>
            )}
            <button type="button" onClick={share} className="sw-ghost w-full h-12 inline-flex items-center justify-center gap-2 font-semibold">
              {copied ? <><Check size={16} aria-hidden="true" /> Link copied</> : <><Copy size={16} aria-hidden="true" /> Share this item</>}
            </button>
            {sizes.length > 0 && !soldOut && <p className="text-sm text-center text-[color:var(--muted)]">You pick your size on the next page.</p>}
          </div>

          <div className="space-y-3 text-[15px] border-t border-[color:var(--line)] pt-6">
            <p className="flex gap-3"><ShieldCheck size={19} className="shrink-0 mt-0.5" style={{ color: accent }} aria-hidden="true" /> Pay with M-Pesa. Solely holds your money and only pays {name} after your order arrives.</p>
            <p className="flex gap-3"><Truck size={19} className="shrink-0 mt-0.5" style={{ color: accent }} aria-hidden="true" /> {name} delivers to you. You agree the delivery fee with them before paying.</p>
          </div>

          {product.description && (
            <div className="space-y-2 border-t border-[color:var(--line)] pt-6">
              <p className="font-semibold">Details</p>
              <p className="leading-relaxed whitespace-pre-line text-[color:var(--muted)]">{product.description}</p>
            </div>
          )}

          {specs.length > 0 && (
            <dl className="border-t border-[color:var(--line)] text-[15px]">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3 border-b border-[color:var(--line)]">
                  <dt className="capitalize text-[color:var(--muted)]">{k.replace(/_/g, " ")}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {more.length > 0 && (
        <section className="pt-24">
          <SectionHead title="More from the shop" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {more.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}
    </div>
  );
};

// ── Entry ──────────────────────────────────────────────────────────────────

export const StoreWebsite = ({ data, settings, base, preview = false, productRef }: {
  data: SiteData;
  settings: SiteSettings;
  base: string;
  preview?: boolean;
  productRef?: string;
}) => {
  const look = THEMES[settings.theme] ?? THEMES.duka;
  // The seller's corner and card choices win over the look's own.
  const radius = CORNERS.find((c) => c.id === settings.corners)?.radius ?? look.radius;
  const theme = useMemo<SiteTheme>(() => ({ ...look, radius, card: settings.card_style ?? look.card }), [look, radius, settings.card_style]);
  const pal = theme.palettes[settings.palette] ?? theme.palettes[0];
  const accent = settings.accent_color || pal.accent;
  const name = shopName(data.profile);

  useEffect(() => loadThemeFonts(theme), [theme]);

  const featuredShown = settings.sections.some((s) => s.id === "featured" && s.visible)
    && data.products.length >= 8 && data.products.filter((p) => p.stock !== 0).length >= 3;
  // The hero shows other items than "New in", when there are enough to go round.
  const rest = featuredShown ? data.products.slice(5) : data.products;
  const heroProducts = rest.filter(imageOf).length >= 3 ? rest : data.products;
  // With no About text of their own, About shows the store description, so
  // the hero doesn't repeat it.
  const describedInAbout = !settings.about;
  const heroLine = settings.tagline || (describedInAbout ? null : data.profile.store_description) || null;
  const value: SiteContextValue = {
    ...data, settings, theme, pal, accent, onAccent: readableOn(accent), name, base, preview, heroProducts, heroLine, featuredShown,
    offer: liveOffer(settings), cta: settings.cta_text?.trim() || null,
  };
  const desc = (settings.tagline || settings.about || data.profile.store_description || `Shop ${name}. Pay safely with M-Pesa, protected by Solely.`).slice(0, 160);
  const ogImage = settings.banner_url || data.profile.store_logo_url || imageOf(data.products[0]);

  return (
    <SiteContext.Provider value={value}>
      <Helmet>
        <title>{settings.tagline ? `${name}: ${settings.tagline}` : `${name} | Shop online`}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={name} />
        <meta property="og:description" content={desc} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="theme-color" content={pal.bg} />
        {preview && <meta name="robots" content="noindex" />}
      </Helmet>
      <Shell productPage={!!productRef}>{productRef ? <SiteProductPage productRef={productRef} /> : <SiteHome />}</Shell>
    </SiteContext.Provider>
  );
};
