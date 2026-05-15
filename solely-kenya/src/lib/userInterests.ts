/**
 * userInterests.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side personalization engine for Solely.
 *
 * Signals tracked (all in localStorage, zero backend changes):
 *   1. Search terms         – existing solely_search_history
 *   2. Product views        – category + brand of every product detail page opened
 *   3. Category clicks      – every time a user clicks a category pill/link
 *   4. Cart additions       – category + brand of items added to cart
 *
 * Scoring weights (tunable):
 *   cart_addition  = 5   (strongest intent signal)
 *   product_view   = 3
 *   category_click = 2
 *   search_term    = 1   (recency-weighted by rankBySearchHistory)
 *
 * The final `rankByInterests` function returns products ordered by score desc,
 * with unscored products shuffled randomly so the feed stays fresh.
 */

// ─── Storage keys ─────────────────────────────────────────────────────────────
const KEYS = {
  views:      "solely_product_views",
  categories: "solely_category_clicks",
  cart:       "solely_cart_interests",
};

const MAX_EVENTS = 30; // rolling window per signal type

// ─── Types ────────────────────────────────────────────────────────────────────
interface InterestEvent {
  category?: string;
  brand?: string;
  ts: number; // unix ms timestamp for recency decay
}

// ─── Generic helpers ──────────────────────────────────────────────────────────
const readEvents = (key: string): InterestEvent[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as InterestEvent[]) : [];
  } catch {
    return [];
  }
};

const writeEvents = (key: string, events: InterestEvent[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    // private browsing / storage full — silently ignore
  }
};

const pushEvent = (key: string, event: InterestEvent) => {
  const events = readEvents(key);
  writeEvents(key, [event, ...events]);
};

// ─── Public tracking functions ────────────────────────────────────────────────

/** Call when a user opens a product detail page */
export const trackProductView = (category?: string, brand?: string) => {
  if (!category && !brand) return;
  pushEvent(KEYS.views, { category: category?.toLowerCase(), brand: brand?.toLowerCase(), ts: Date.now() });
};

/** Call when a user clicks a category pill or nav link */
export const trackCategoryClick = (category: string) => {
  if (!category || category === "all") return;
  pushEvent(KEYS.categories, { category: category.toLowerCase(), ts: Date.now() });
};

/** Call when a user adds an item to cart */
export const trackCartAddition = (category?: string, brand?: string) => {
  if (!category && !brand) return;
  pushEvent(KEYS.cart, { category: category?.toLowerCase(), brand: brand?.toLowerCase(), ts: Date.now() });
};

// ─── Profile builder ──────────────────────────────────────────────────────────
interface InterestProfile {
  /** category key → weighted score */
  categories: Record<string, number>;
  /** brand name (lowercase) → weighted score */
  brands: Record<string, number>;
  /** top category key, or null */
  topCategory: string | null;
  /** top brand, or null */
  topBrand: string | null;
  /** human-readable labels for the "Because you viewed…" chip */
  reasonLabels: string[];
}

/**
 * Recency decay: events from the last hour get full weight,
 * events older than 7 days get ~10% weight.
 */
const decayWeight = (ts: number): number => {
  const ageMs   = Date.now() - ts;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.max(0.1, 1 - ageDays / 10); // linear decay over 10 days
};

export const buildInterestProfile = (): InterestProfile => {
  const categories: Record<string, number> = {};
  const brands: Record<string, number>     = {};

  const accumulate = (events: InterestEvent[], baseWeight: number) => {
    events.forEach((ev) => {
      const w = baseWeight * decayWeight(ev.ts);
      if (ev.category) categories[ev.category] = (categories[ev.category] || 0) + w;
      if (ev.brand)    brands[ev.brand]         = (brands[ev.brand]     || 0) + w;
    });
  };

  accumulate(readEvents(KEYS.cart),       5); // strongest signal
  accumulate(readEvents(KEYS.views),      3);
  accumulate(readEvents(KEYS.categories), 2);

  const topCategory = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0] ?? null;
  const topBrand    = Object.keys(brands).sort((a, b) => brands[b] - brands[a])[0] ?? null;

  const reasonLabels: string[] = [];
  if (topCategory) reasonLabels.push(topCategory.replace(/-/g, " "));
  if (topBrand)    reasonLabels.push(topBrand);

  return { categories, brands, topCategory, topBrand, reasonLabels };
};

// ─── Ranking ──────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns new array) */
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

type ProductLike = {
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  [key: string]: any;
};

/**
 * Rank products using all interest signals.
 *
 * Also incorporates existing search-history ranking by pulling from
 * solely_search_history and scoring name/brand/category/description matches.
 */
export const rankByInterests = <T extends ProductLike>(products: T[]): T[] => {
  const profile = buildInterestProfile();

  // Pull search history for additional scoring
  let searchTerms: { term: string; weight: number }[] = [];
  try {
    const raw = localStorage.getItem("solely_search_history");
    const history: string[] = raw ? JSON.parse(raw) : [];
    const MAX = 15;
    searchTerms = history.map((term, idx) => ({ term, weight: MAX - idx }));
  } catch {
    // ignore
  }

  const hasAnySignal =
    Object.keys(profile.categories).length > 0 ||
    Object.keys(profile.brands).length > 0 ||
    searchTerms.length > 0;

  if (!hasAnySignal) {
    return shuffle(products);
  }

  const scored = products.map((p) => {
    let score = 0;
    const cat   = p.category?.toLowerCase()    ?? "";
    const brand = p.brand?.toLowerCase()       ?? "";
    const name  = p.name?.toLowerCase()        ?? "";
    const desc  = p.description?.toLowerCase() ?? "";

    // Category interest score
    if (cat && profile.categories[cat]) score += profile.categories[cat];

    // Brand interest score
    if (brand && profile.brands[brand]) score += profile.brands[brand];

    // Search history score
    searchTerms.forEach(({ term, weight }) => {
      if (name.includes(term) || brand.includes(term) || cat.includes(term) || desc.includes(term)) {
        score += weight * 0.5; // search gets half weight vs direct interactions
      }
    });

    return { product: p, score };
  });

  const boosted = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const rest    = shuffle(scored.filter((s) => s.score === 0));

  return [...boosted, ...rest].map((s) => s.product);
};

/** Returns true if the user has any tracked interest data */
export const hasInterestData = (): boolean => {
  const profile = buildInterestProfile();
  return (
    Object.keys(profile.categories).length > 0 ||
    Object.keys(profile.brands).length > 0
  );
};

/** Clear all interest data (e.g. on sign-out) */
export const clearInterests = () => {
  Object.values(KEYS).forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* noop */ }
  });
};
