/**
 * /store/:storeLink (and /store/:storeLink/p/:productRef): the seller's own
 * website when they've switched it on, otherwise the standard store page.
 * /site-preview/:storeLink is the same website with unsaved settings, shown in
 * the seller's editor.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  PREVIEW_MESSAGE, fetchShopProfile, fetchSiteProducts, fetchSiteReviews, fetchSiteRow, settingsFromRow,
  type SiteRow, type SiteSettings, type ThemeId,
} from "@/lib/storeSite";
import { StoreWebsite, type SiteData } from "./StoreSite";
import { THEMES } from "./templates";

// Links shared before the looks were renamed.
const LEGACY_THEMES: Record<string, ThemeId> = { classic: "duka", boutique: "atelier", bold: "street", thrift: "mitumba", tech: "gadget" };

const draftKey = (storeLink: string) => `solely:site-draft:${storeLink}`;

/** The editor keeps its unsaved settings here so "Full preview" can show them. */
export const writeDraft = (storeLink: string, settings: SiteSettings) => {
  try { localStorage.setItem(draftKey(storeLink), JSON.stringify(settings)); } catch { /* storage blocked */ }
};

const readDraft = (storeLink: string): Partial<SiteSettings> | null => {
  try {
    const raw = localStorage.getItem(draftKey(storeLink));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

interface Loaded { row: SiteRow | null; data: SiteData | null }

// Moving between the home page and product pages remounts the route, so keep
// what we fetched for a minute rather than loading the shop again each tap.
const cache = new Map<string, { at: number; value: Loaded }>();

const loadStore = async (storeLink: string, withData: (row: SiteRow | null) => boolean): Promise<Loaded> => {
  const hit = cache.get(storeLink);
  if (hit && Date.now() - hit.at < 60_000 && (hit.value.data || !withData(hit.value.row))) return hit.value;

  const profile = await fetchShopProfile(storeLink);
  if (!profile) return { row: null, data: null };
  const row = await fetchSiteRow(profile.id);
  let data: SiteData | null = null;
  if (withData(row)) {
    const [products, reviews] = await Promise.all([fetchSiteProducts(profile.id), fetchSiteReviews(profile.id)]);
    data = { profile, products, reviews };
  }
  const value = { row, data };
  cache.set(storeLink, { at: Date.now(), value });
  return value;
};

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center" aria-busy="true" aria-label="Loading shop">
    <div className="h-8 w-8 rounded-full border-2 border-current border-t-transparent animate-spin opacity-30" />
  </div>
);

export const StorePage = ({ fallback }: { fallback: ReactNode }) => {
  const { storeLink = "", productRef } = useParams();
  const [state, setState] = useState<Loaded | null>(null);

  useEffect(() => {
    let live = true;
    loadStore(storeLink, (row) => !!row?.enabled).then((v) => live && setState(v));
    return () => { live = false; };
  }, [storeLink]);

  if (!state) return <Loading />;
  if (!state.row?.enabled || !state.data) {
    // No website: product links from an old website still work.
    return productRef ? <Navigate to={`/buy/${productRef}`} replace /> : <>{fallback}</>;
  }
  return (
    <StoreWebsite
      data={state.data}
      settings={settingsFromRow(state.row)}
      base={`/store/${state.data.profile.store_link}`}
      productRef={productRef}
    />
  );
};

export const StorePreview = () => {
  const { storeLink = "", productRef } = useParams();
  const [state, setState] = useState<Loaded | null>(null);
  // Opening order: the editor's unsaved changes (its "Full preview" tab), then
  // ?theme=street to open a look directly. Inside the editor's iframe, live
  // settings then arrive by postMessage.
  const [draft, setDraft] = useState<Partial<SiteSettings>>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("theme") || LEGACY_THEMES[params.get("template") ?? ""];
    if (t && t in THEMES) return { theme: t as ThemeId, hero_style: null };
    return readDraft(storeLink) ?? {};
  });

  useEffect(() => {
    loadStore(storeLink, () => true).then(setState);
  }, [storeLink]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== PREVIEW_MESSAGE) return;
      setDraft(e.data.settings ?? {});
    };
    window.addEventListener("message", onMessage);
    if (window.parent !== window) window.parent.postMessage({ type: `${PREVIEW_MESSAGE}:ready` }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!state) return <Loading />;
  if (!state.data) return <p className="p-10 text-center">We couldn't find this shop.</p>;
  return (
    <StoreWebsite
      data={state.data}
      settings={settingsFromRow({ ...(state.row ?? {}), ...draft } as SiteRow)}
      base={`/site-preview/${storeLink}`}
      productRef={productRef}
      preview
    />
  );
};
