/**
 * Seller websites: a seller can switch their store page
 * (/store/<store_link>) into their own designed website. This file holds the
 * data side: settings, sections and the queries the website needs.
 */
import { supabase } from "@/integrations/supabase/client";

export type ThemeId =
  | "duka" | "atelier" | "street" | "mitumba" | "gadget"
  | "maison" | "pulse" | "bloom" | "atlas" | "souk";
export type HeroStyle =
  | "mosaic" | "portrait" | "type" | "line" | "stage"
  | "fullbleed" | "marquee" | "arch" | "collage" | "banner";
export type CardStyle = "tile" | "gallery" | "tag" | "peg" | "spec" | "editorial" | "neon" | "soft" | "plain" | "deal";
export type Corners = "sharp" | "soft" | "round";
export type TextScale = "small" | "large" | "xlarge";
export type HeadingWeight = "regular" | "bold";

/** How much bigger or smaller than the look's own each size choice makes text. */
export const SCALE_FACTOR: Record<TextScale, number> = { small: 0.85, large: 1.15, xlarge: 1.3 };
export type SectionId = "offer" | "featured" | "categories" | "products" | "perks" | "gallery" | "reviews" | "faq" | "about";

export interface Faq {
  q: string;
  a: string;
}

export interface SectionSetting {
  id: SectionId;
  visible: boolean;
}

export interface SiteSettings {
  theme: ThemeId;
  palette: number;
  accent_color: string | null;
  hero_style: HeroStyle | null;
  sections: SectionSetting[];
  tagline: string | null;
  about: string | null;
  announcement: string | null;
  banner_url: string | null;
  instagram: string | null;
  tiktok: string | null;
  card_style: CardStyle | null;
  corners: Corners | null;
  grid_cols: 3 | 4 | null;
  heading_scale: TextScale | null;
  text_scale: TextScale | null;
  heading_weight: HeadingWeight | null;
  text_color: string | null;
  heading_color: string | null;
  hero_title: string | null;
  cta_text: string | null;
  whatsapp_button: boolean;
  gallery: string[];
  faqs: Faq[];
  offer_title: string | null;
  offer_text: string | null;
  offer_ends_at: string | null;
}

export interface SiteRow extends SiteSettings {
  vendor_id: string;
  enabled: boolean;
}

/** The shop's public profile. */
export interface ShopProfile {
  id: string;
  store_link: string;
  store_name: string | null;
  full_name: string | null;
  store_logo_url: string | null;
  store_description: string | null;
  vendor_city: string | null;
  vendor_county: string | null;
  kyc_status: string | null;
  store_phone: string | null;
}

export const SECTION_LABELS: Record<SectionId, { name: string; hint: string }> = {
  offer: { name: "Offer banner", hint: "Your current offer with a live countdown (set it in the Offers tab)" },
  featured: { name: "New in", hint: "Your newest pieces, shown big (shops with 8+ items)" },
  categories: { name: "Shop by category", hint: "Photo tiles for each category (2+ categories)" },
  products: { name: "All products", hint: "Everything you sell, with search" },
  perks: { name: "Why buy here", hint: "Safe payment, delivery and chat, in one strip" },
  gallery: { name: "Gallery", hint: "Your own photos, like a lookbook (add them in Content)" },
  reviews: { name: "Reviews", hint: "What buyers said about you" },
  faq: { name: "Questions", hint: "Delivery, returns and payment answers (add them in Content)" },
  about: { name: "About you", hint: "Your story, location, phone, Instagram and TikTok" },
};

export const DEFAULT_SECTIONS: SectionSetting[] = [
  { id: "offer", visible: true },
  { id: "featured", visible: true },
  { id: "categories", visible: true },
  { id: "products", visible: true },
  { id: "perks", visible: true },
  { id: "gallery", visible: true },
  { id: "reviews", visible: true },
  { id: "faq", visible: true },
  { id: "about", visible: true },
];

export const DEFAULT_SETTINGS: SiteSettings = {
  theme: "duka",
  palette: 0,
  accent_color: null,
  hero_style: null,
  sections: DEFAULT_SECTIONS,
  tagline: null,
  about: null,
  announcement: null,
  banner_url: null,
  instagram: null,
  tiktok: null,
  card_style: null,
  corners: null,
  grid_cols: null,
  heading_scale: null,
  text_scale: null,
  heading_weight: null,
  text_color: null,
  heading_color: null,
  hero_title: null,
  cta_text: null,
  whatsapp_button: true,
  gallery: [],
  faqs: [],
  offer_title: null,
  offer_text: null,
  offer_ends_at: null,
};

/**
 * Saved sections in order. A section added since they last saved goes where it
 * sits in the default order (the offer banner near the top, not at the end).
 */
export const normaliseSections = (saved: unknown): SectionSetting[] => {
  const list = Array.isArray(saved) ? (saved as SectionSetting[]) : [];
  const out = list.filter((s) => s && s.id in SECTION_LABELS);
  const seen = new Set(out.map((s) => s.id));
  DEFAULT_SECTIONS.forEach((def, i) => {
    if (seen.has(def.id)) return;
    out.splice(Math.min(i, out.length), 0, def);
  });
  return out;
};

export const settingsFromRow = (row: Partial<SiteRow> | null | undefined): SiteSettings => ({
  ...DEFAULT_SETTINGS,
  ...(row ?? {}),
  sections: normaliseSections(row?.sections),
  gallery: Array.isArray(row?.gallery) ? row.gallery.filter(Boolean) : [],
  faqs: Array.isArray(row?.faqs) ? row.faqs.filter((f) => f?.q?.trim() && f?.a?.trim()) : [],
});

// ── Offers ─────────────────────────────────────────────────────────────────

export interface LiveOffer {
  title: string;
  text: string | null;
  endsAt: Date;
}

/** The seller's offer, if it has a title and hasn't ended. */
export const liveOffer = (
  s: Pick<SiteSettings, "offer_title" | "offer_text" | "offer_ends_at">,
  now = Date.now(),
): LiveOffer | null => {
  const title = s.offer_title?.trim();
  if (!title || !s.offer_ends_at) return null;
  const endsAt = new Date(s.offer_ends_at);
  return endsAt.getTime() > now ? { title, text: s.offer_text?.trim() || null, endsAt } : null;
};

/** How long is left, as parts and as "2d 04h" / "3h 12m" / "9m 40s". */
export const timeLeft = (endsAt: Date, now = Date.now()) => {
  const total = Math.max(0, Math.floor((endsAt.getTime() - now) / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d, h, m, s, total, short: d > 0 ? `${d}d ${pad(h)}h` : h > 0 ? `${h}h ${pad(m)}m` : `${m}m ${pad(s)}s` };
};

/** A Kenyan number in any common form (0712…, +254712…, 712…) as digits for wa.me. */
export const whatsappNumber = (phone: string | null) => {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("254") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 10) return `254${d.slice(1)}`;
  if (d.length === 9) return `254${d}`;
  return null;
};

// ── Queries ────────────────────────────────────────────────────────────────

const PROFILE_COLUMNS =
  "id, store_link, store_name, full_name, store_logo_url, store_description, vendor_city, vendor_county, kyc_status, store_phone";

export const fetchShopProfile = async (storeLink: string): Promise<ShopProfile | null> => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeLink);
  const { data } = await (supabase as any)
    .from("public_vendor_profiles")
    .select(PROFILE_COLUMNS)
    .eq(isUuid ? "id" : "store_link", storeLink)
    .maybeSingle();
  if (data || isUuid) return (data as ShopProfile) ?? null;

  // The shop may have been renamed since this link was shared.
  const vendorId = await fetchVendorIdByOldLink(storeLink);
  if (!vendorId) return null;
  const { data: renamed } = await (supabase as any)
    .from("public_vendor_profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", vendorId)
    .maybeSingle();
  return (renamed as ShopProfile) ?? null;
};

/** The shop a retired link used to point at, if any. Best effort: null if the table isn't there yet. */
export const fetchVendorIdByOldLink = async (link: string): Promise<string | null> => {
  const { data } = await (supabase as any).from("store_link_aliases").select("vendor_id").eq("link", link).maybeSingle();
  return (data?.vendor_id as string) ?? null;
};

/** The seller's website settings, or null when they haven't made one. */
export const fetchSiteRow = async (vendorId: string): Promise<SiteRow | null> => {
  const { data } = await (supabase as any).from("store_sites").select("*").eq("vendor_id", vendorId).maybeSingle();
  return (data as SiteRow) ?? null;
};

export interface SiteProduct {
  id: string;
  short_code: string | null;
  name: string;
  price_ksh: number;
  images: string[] | null;
  brand: string | null;
  description: string | null;
  condition: string | null;
  category: string | null;
  sizes: string[] | null;
  colors: string[] | null;
  stock: number | null;
  specs: Record<string, string> | null;
  created_at: string;
}

const PRODUCT_COLUMNS =
  "id, short_code, name, price_ksh, images, brand, description, condition, category, sizes, colors, stock, specs, created_at";

export const fetchSiteProducts = async (vendorId: string): Promise<SiteProduct[]> => {
  const { data } = await (supabase as any)
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("vendor_id", vendorId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data as SiteProduct[]) ?? [];
};

export interface SiteReview {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
}

export const fetchSiteReviews = async (vendorId: string) => {
  const [{ data: stats }, { data: reviews }] = await Promise.all([
    supabase.from("vendor_rating_stats").select("avg_rating, rating_count").eq("vendor_id", vendorId).maybeSingle(),
    (supabase as any)
      .from("vendor_ratings")
      .select("id, rating, review, created_at")
      .eq("vendor_id", vendorId)
      .not("review", "is", null)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  return {
    avg: Number((stats as any)?.avg_rating ?? 0),
    count: Number((stats as any)?.rating_count ?? 0),
    reviews: ((reviews as SiteReview[]) ?? []).filter((r) => r.review?.trim()),
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────

export const storePath = (storeLink: string) => `/store/${storeLink}`;
export const productPath = (base: string, p: Pick<SiteProduct, "id" | "short_code">) => `${base}/p/${p.short_code || p.id}`;
/** The secure Solely checkout for one product, tagged as coming from the seller's website. */
export const checkoutPath = (p: Pick<SiteProduct, "id" | "short_code">) => `/buy/${p.short_code || p.id}?via=site`;

export const ksh = (n: number) => `KES ${Math.round(n).toLocaleString("en-US")}`;

export const CONDITION_LABEL: Record<string, string> = {
  new: "New", like_new: "Like new", good: "Thrifted", fair: "Thrifted",
  thrifted: "Thrifted", refurbished: "Refurbished",
};

export const shopName = (p: ShopProfile) => p.store_name?.trim() || p.full_name?.trim() || "Our shop";

export const shopPlace = (p: ShopProfile) =>
  Array.from(new Set([p.vendor_city, p.vendor_county].map((s) => s?.trim()).filter(Boolean))).join(", ") || null;

/** Black or white text, whichever reads better on this colour. */
export const readableOn = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#141414" : "#ffffff";
};

/** "@handle", "handle" or a full link → a full link. */
export const socialUrl = (kind: "instagram" | "tiktok", value: string | null) => {
  if (!value) return null;
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/\s+/g, "");
  if (!handle) return null;
  return kind === "instagram" ? `https://instagram.com/${handle}` : `https://www.tiktok.com/@${handle}`;
};

export const socialHandle = (value: string | null) => {
  if (!value) return null;
  const v = value.trim();
  const fromUrl = v.match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#]+)/i);
  return `@${(fromUrl ? fromUrl[1] : v).replace(/^@/, "")}`;
};

export const PREVIEW_MESSAGE = "solely:site-preview";
