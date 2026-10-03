import type { CardStyle, Corners, HeroStyle, ThemeId } from "@/lib/storeSite";

export type { CardStyle };

/**
 * The looks a seller can give their website. Each is a full direction
 * (typefaces, palettes, product cards, a default hero) drawn from the kind of
 * shop it suits, so two shops on different looks don't read as one template.
 */
export interface Palette {
  name: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  dark?: boolean;
}

export interface SiteTheme {
  id: ThemeId;
  name: string;
  suits: string;
  /** One line on what makes this look different, shown on its card in the editor. */
  signature?: string;
  /** A newer, more elaborate look. */
  premium?: boolean;
  fontsHref: string;
  display: string;
  body: string;
  displayWeight: number;
  /** Extra tracking / case for display type. */
  displayStyle?: { letterSpacing?: string; textTransform?: "uppercase"; lineHeight?: number };
  radius: number;
  card: CardStyle;
  hero: HeroStyle;
  palettes: [Palette, Palette, Palette];
}

const gf = (families: string) => `https://fonts.googleapis.com/css2?${families}&display=swap`;

export const THEMES: Record<ThemeId, SiteTheme> = {
  duka: {
    id: "duka",
    name: "Duka",
    suits: "Any shop. Bright and friendly.",
    fontsHref: gf("family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700"),
    display: "'Bricolage Grotesque', system-ui, sans-serif",
    body: "'Figtree', system-ui, sans-serif",
    displayWeight: 800,
    displayStyle: { letterSpacing: "-0.03em", lineHeight: 0.95 },
    radius: 18,
    card: "tile",
    hero: "mosaic",
    palettes: [
      { name: "Daylight", bg: "#ffffff", surface: "#f1f4f9", ink: "#14213d", muted: "#5a6479", line: "#e1e6ef", accent: "#f4b400" },
      { name: "Sky", bg: "#edf3ff", surface: "#ffffff", ink: "#0f2a5f", muted: "#52607a", line: "#d3dff3", accent: "#ff6b35" },
      { name: "Night", bg: "#0f1a2e", surface: "#18264a", ink: "#f1f4fa", muted: "#a3adc2", line: "#26375c", accent: "#ffc93c", dark: true },
    ],
  },
  atelier: {
    id: "atelier",
    name: "Atelier",
    suits: "Fashion, beauty and jewellery.",
    fontsHref: gf("family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700"),
    display: "'Instrument Serif', Georgia, serif",
    body: "'Manrope', system-ui, sans-serif",
    displayWeight: 400,
    displayStyle: { letterSpacing: "-0.01em", lineHeight: 0.92 },
    radius: 2,
    card: "gallery",
    hero: "portrait",
    palettes: [
      { name: "Sage", bg: "#eef1ec", surface: "#e2e8df", ink: "#1f3b2d", muted: "#5e7266", line: "#d2dbce", accent: "#c46b7b" },
      { name: "Blush", bg: "#f8eeee", surface: "#f0e0e0", ink: "#3b1f2b", muted: "#7c5f68", line: "#e8d1d1", accent: "#5f7d66" },
      { name: "Ink", bg: "#191e1b", surface: "#232925", ink: "#eef1ec", muted: "#a3aea6", line: "#323a35", accent: "#e3a3ad", dark: true },
    ],
  },
  street: {
    id: "street",
    name: "Street",
    suits: "Sneakers, streetwear and drops.",
    fontsHref: gf("family=Anton&family=Barlow:wght@400;500;600;700"),
    display: "'Anton', Impact, sans-serif",
    body: "'Barlow', system-ui, sans-serif",
    displayWeight: 400,
    displayStyle: { letterSpacing: "0.005em", textTransform: "uppercase", lineHeight: 0.88 },
    radius: 4,
    card: "tag",
    hero: "type",
    palettes: [
      { name: "Concrete", bg: "#e7e6e2", surface: "#f4f3f0", ink: "#1b1b1b", muted: "#5c5b57", line: "#cfcdc7", accent: "#ff5a1f" },
      { name: "Court", bg: "#f3f4ef", surface: "#ffffff", ink: "#14213d", muted: "#5b6070", line: "#dfe1d8", accent: "#2b50ff" },
      { name: "Tarmac", bg: "#1f2124", surface: "#2a2d31", ink: "#f3f3f0", muted: "#a4a6a8", line: "#3a3d42", accent: "#ff5a1f", dark: true },
    ],
  },
  mitumba: {
    id: "mitumba",
    name: "Mitumba",
    suits: "Thrift, vintage and one-of-one pieces.",
    fontsHref: gf("family=Young+Serif&family=Karla:wght@400;500;600;700"),
    display: "'Young Serif', Georgia, serif",
    body: "'Karla', system-ui, sans-serif",
    displayWeight: 400,
    displayStyle: { letterSpacing: "-0.02em", lineHeight: 1 },
    radius: 6,
    card: "peg",
    hero: "line",
    palettes: [
      { name: "Mint", bg: "#dfeee9", surface: "#f3faf7", ink: "#3a1f3d", muted: "#6e5a70", line: "#c4dbd3", accent: "#e8912d" },
      { name: "Denim", bg: "#dde6f2", surface: "#f4f7fb", ink: "#1f2d4a", muted: "#56617a", line: "#c6d2e6", accent: "#e4572e" },
      { name: "Plum", bg: "#2e1a31", surface: "#3b2340", ink: "#fbeee0", muted: "#cdb6c4", line: "#4c3151", accent: "#f2a541", dark: true },
    ],
  },
  gadget: {
    id: "gadget",
    name: "Gadget",
    suits: "Phones, laptops and electronics.",
    fontsHref: gf("family=Sora:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600"),
    display: "'Sora', system-ui, sans-serif",
    body: "'IBM Plex Sans', system-ui, sans-serif",
    displayWeight: 600,
    displayStyle: { letterSpacing: "-0.035em", lineHeight: 1 },
    radius: 14,
    card: "spec",
    hero: "stage",
    palettes: [
      { name: "Studio", bg: "#f7f7f8", surface: "#ffffff", ink: "#0f172a", muted: "#5b6475", line: "#e4e6ea", accent: "#0e9f9e" },
      { name: "Graphite", bg: "#e9ecef", surface: "#f8f9fa", ink: "#111827", muted: "#4b5563", line: "#d5dae0", accent: "#e11d48" },
      { name: "Midnight", bg: "#0d1117", surface: "#161b22", ink: "#e6edf3", muted: "#8b949e", line: "#262d36", accent: "#2dd4bf", dark: true },
    ],
  },

  // ── Premium looks ────────────────────────────────────────────────────────
  maison: {
    id: "maison",
    premium: true,
    name: "Maison",
    suits: "Jewellery, beauty, perfume and gifts.",
    signature: "Full-screen photo, quiet gold details, magazine-style product cards.",
    fontsHref: gf("family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500;600"),
    display: "'Cormorant Garamond', Georgia, serif",
    body: "'Jost', system-ui, sans-serif",
    displayWeight: 500,
    displayStyle: { letterSpacing: "-0.015em", lineHeight: 0.95 },
    radius: 0,
    card: "editorial",
    hero: "fullbleed",
    palettes: [
      { name: "Ivory", bg: "#faf7f2", surface: "#f1ebe1", ink: "#1c1a17", muted: "#6f685d", line: "#e2dacb", accent: "#a67c4e" },
      { name: "Noir", bg: "#0f0e0d", surface: "#1a1816", ink: "#f4eee5", muted: "#a59d90", line: "#2c2925", accent: "#c9a56a", dark: true },
      { name: "Rosé", bg: "#f7ebe8", surface: "#efdad6", ink: "#3b2224", muted: "#85666a", line: "#e5cdc9", accent: "#a85c63" },
    ],
  },
  pulse: {
    id: "pulse",
    premium: true,
    name: "Pulse",
    suits: "Sneaker drops, streetwear and anything hyped.",
    signature: "Scrolling giant name, glowing cards, and a live countdown for your drops.",
    fontsHref: gf("family=Unbounded:wght@500;700;800&family=DM+Sans:wght@400;500;700"),
    display: "'Unbounded', system-ui, sans-serif",
    body: "'DM Sans', system-ui, sans-serif",
    displayWeight: 800,
    displayStyle: { letterSpacing: "-0.045em", lineHeight: 0.95 },
    radius: 12,
    card: "neon",
    hero: "marquee",
    palettes: [
      { name: "Voltage", bg: "#08080a", surface: "#131318", ink: "#f7f7f8", muted: "#9a9aa6", line: "#25252d", accent: "#c8ff2e", dark: true },
      { name: "Ultra", bg: "#0c0720", surface: "#17102f", ink: "#f4f1ff", muted: "#a79fc9", line: "#2b2150", accent: "#8f6bff", dark: true },
      { name: "Flare", bg: "#f3f2ee", surface: "#ffffff", ink: "#09090b", muted: "#62626b", line: "#dcdad3", accent: "#ff3b2f" },
    ],
  },
  bloom: {
    id: "bloom",
    premium: true,
    name: "Bloom",
    suits: "Beauty, kids, gifts and lifestyle.",
    signature: "Soft arches, rounded cards and warm pastel colours.",
    fontsHref: gf("family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito+Sans:wght@400;600;700;800"),
    display: "'Fraunces', Georgia, serif",
    body: "'Nunito Sans', system-ui, sans-serif",
    displayWeight: 600,
    displayStyle: { letterSpacing: "-0.025em", lineHeight: 1 },
    radius: 28,
    card: "soft",
    hero: "arch",
    palettes: [
      { name: "Peach", bg: "#fff4ec", surface: "#ffe4d4", ink: "#4a2418", muted: "#8d6454", line: "#f7d3bd", accent: "#e8602c" },
      { name: "Lilac", bg: "#f5f0fd", surface: "#e9defa", ink: "#2c1a4a", muted: "#6f5f8f", line: "#dacdf2", accent: "#7a4bd6" },
      { name: "Meadow", bg: "#f0f7ea", surface: "#e0eed2", ink: "#1f3a1a", muted: "#5d7a55", line: "#cfe2bd", accent: "#3b8a36" },
    ],
  },
  atlas: {
    id: "atlas",
    premium: true,
    name: "Atlas",
    suits: "Furniture, art, home and décor.",
    signature: "Overlapping photo collage and a staggered gallery grid.",
    fontsHref: gf("family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;1,6..96,400&family=Hanken+Grotesk:wght@400;500;600;700"),
    display: "'Bodoni Moda', Georgia, serif",
    body: "'Hanken Grotesk', system-ui, sans-serif",
    displayWeight: 500,
    displayStyle: { letterSpacing: "-0.02em", lineHeight: 0.98 },
    radius: 0,
    card: "plain",
    hero: "collage",
    palettes: [
      { name: "Linen", bg: "#f2eee7", surface: "#e7e0d3", ink: "#2b2620", muted: "#7a7064", line: "#d9d1c2", accent: "#b4532a" },
      { name: "Slate", bg: "#eaedee", surface: "#dde2e4", ink: "#1b2326", muted: "#5e6b70", line: "#cbd2d5", accent: "#2d6f73" },
      { name: "Espresso", bg: "#1b1612", surface: "#271f19", ink: "#f1e9dd", muted: "#b0a493", line: "#382e25", accent: "#dba365", dark: true },
    ],
  },
  souk: {
    id: "souk",
    premium: true,
    name: "Soko",
    suits: "Deals, bulk, groceries and everyday goods.",
    signature: "A poster-style offer banner and price-first cards that push people to order.",
    fontsHref: gf("family=Archivo+Black&family=Archivo:wght@400;500;600;700"),
    display: "'Archivo Black', Impact, sans-serif",
    body: "'Archivo', system-ui, sans-serif",
    displayWeight: 400,
    displayStyle: { letterSpacing: "-0.02em", lineHeight: 0.95 },
    radius: 14,
    card: "deal",
    hero: "banner",
    palettes: [
      { name: "Fresh", bg: "#fffcf2", surface: "#ffffff", ink: "#16130c", muted: "#665f4c", line: "#ece4c8", accent: "#e11d48" },
      { name: "Market", bg: "#f0f8f1", surface: "#ffffff", ink: "#0c2a16", muted: "#4f6f59", line: "#cfe5d3", accent: "#f59e0b" },
      { name: "Navy", bg: "#0a1a33", surface: "#12284a", ink: "#f2f6fc", muted: "#9db0cd", line: "#1f3a63", accent: "#ffb703", dark: true },
    ],
  },
};

export const THEME_LIST = Object.values(THEMES);

export const HERO_STYLES: { id: HeroStyle; name: string; hint: string }[] = [
  { id: "mosaic", name: "Photo mosaic", hint: "Your name beside a grid of your products" },
  { id: "portrait", name: "Big photo", hint: "One large photo with your name over it" },
  { id: "type", name: "Big name", hint: "Your shop name huge, with products on top" },
  { id: "line", name: "Clothesline", hint: "Products pegged on a line" },
  { id: "stage", name: "Spotlight", hint: "One product in the spotlight with its price" },
  { id: "fullbleed", name: "Full screen", hint: "A full-width photo with your name over it" },
  { id: "marquee", name: "Scrolling name", hint: "Your name scrolls across, products below" },
  { id: "arch", name: "Arches", hint: "Photos in soft arch frames" },
  { id: "collage", name: "Collage", hint: "Overlapping photos like a magazine spread" },
  { id: "banner", name: "Poster banner", hint: "A bold banner built around your offer" },
];

export const CARD_STYLES: { id: CardStyle; name: string; hint: string }[] = [
  { id: "tile", name: "Tiles", hint: "Clean cards, a New tag" },
  { id: "gallery", name: "Gallery", hint: "Tall photos, price in serif" },
  { id: "tag", name: "Price tag", hint: "Big names, a tilted price sticker" },
  { id: "peg", name: "Polaroid", hint: "Pegged photos, one-of-one tags" },
  { id: "spec", name: "Spec sheet", hint: "Brand and key specs, photo on white" },
  { id: "editorial", name: "Magazine", hint: "Quiet captions, 'View' slides up" },
  { id: "neon", name: "Glow", hint: "Dark cards that light up on hover" },
  { id: "soft", name: "Soft", hint: "Round, friendly, price in a pill" },
  { id: "plain", name: "Plain", hint: "Just the photo and a caption" },
  { id: "deal", name: "Price first", hint: "Big price, stock warning, order button" },
];

export const CORNERS: { id: Corners; name: string; radius: number }[] = [
  { id: "sharp", name: "Sharp", radius: 0 },
  { id: "soft", name: "Soft", radius: 10 },
  { id: "round", name: "Round", radius: 26 },
];

/** Load a look's web fonts once per page. */
export const loadThemeFonts = (theme: SiteTheme) => {
  if (typeof document === "undefined") return;
  const id = `site-font-${theme.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = theme.fontsHref;
  document.head.appendChild(link);
};
