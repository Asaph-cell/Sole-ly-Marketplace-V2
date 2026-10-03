/**
 * Offers sellers post on their own website also show on the main Solely
 * marketplace (a badge on their products, an "Offers right now" row), so
 * marketplace traffic becomes traffic to the seller. This is the shared lookup.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MarketOffer {
  vendorId: string;
  title: string;
  text: string | null;
  endsAt: Date;
  storeLink: string;
  shopName: string;
  logo: string | null;
  /** Cover photo of the shop's newest listing, for the offers strip. */
  photo: string | null;
}

type OfferMap = Map<string, MarketOffer>;

let cache: { at: number; promise: Promise<OfferMap> } | null = null;

const load = async (): Promise<OfferMap> => {
  const { data: sites } = await (supabase as any)
    .from("store_sites")
    .select("vendor_id, offer_title, offer_text, offer_ends_at")
    .eq("enabled", true)
    .not("offer_title", "is", null)
    .gt("offer_ends_at", new Date().toISOString())
    .order("offer_ends_at", { ascending: true })
    .limit(60);
  const rows = ((sites as any[]) ?? []).filter((r) => r.offer_title?.trim());
  const out: OfferMap = new Map();
  if (!rows.length) return out;

  const { data: profiles } = await (supabase as any)
    .from("public_vendor_profiles")
    .select("id, store_name, full_name, store_link, store_logo_url")
    .in("id", rows.map((r) => r.vendor_id));
  const byId = new Map<string, any>(((profiles as any[]) ?? []).map((p) => [p.id, p]));

  // One product photo per shop. Best effort: tiles fall back to the logo.
  const { data: prods } = await (supabase as any)
    .from("products")
    .select("vendor_id, images")
    .in("vendor_id", rows.map((r) => r.vendor_id))
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200);
  const photoOf = new Map<string, string>();
  ((prods as any[]) ?? []).forEach((p) => {
    const img = Array.isArray(p.images) ? p.images.find(Boolean) : null;
    if (img && !photoOf.has(p.vendor_id)) photoOf.set(p.vendor_id, img);
  });

  rows.forEach((r) => {
    const p = byId.get(r.vendor_id);
    if (!p) return;
    out.set(r.vendor_id, {
      vendorId: r.vendor_id,
      title: r.offer_title.trim(),
      text: r.offer_text?.trim() || null,
      endsAt: new Date(r.offer_ends_at),
      storeLink: p.store_link || p.id,
      shopName: (p.store_name || p.full_name || "Shop").trim(),
      logo: p.store_logo_url ?? null,
      photo: photoOf.get(r.vendor_id) ?? null,
    });
  });
  return out;
};

/** Live offers by seller id. Fetched once a minute at most, however many cards ask. */
export const fetchLiveOffers = (): Promise<OfferMap> => {
  if (!cache || Date.now() - cache.at > 60_000) {
    const promise = load().catch(() => new Map() as OfferMap);
    cache = { at: Date.now(), promise };
  }
  return cache.promise;
};

export const useLiveOffers = (): OfferMap => {
  const [offers, setOffers] = useState<OfferMap>(new Map());
  useEffect(() => {
    let live = true;
    fetchLiveOffers().then((m) => live && setOffers(m));
    return () => { live = false; };
  }, []);
  return offers;
};

/** "Ends in 2 days", "Ends today", "Ends in 5h". */
export const endsIn = (endsAt: Date, now = Date.now()) => {
  const hours = Math.max(0, Math.floor((endsAt.getTime() - now) / 3_600_000));
  if (hours >= 48) return `Ends in ${Math.floor(hours / 24)} days`;
  if (hours >= 24) return "Ends tomorrow";
  if (hours >= 1) return `Ends in ${hours}h`;
  return "Ends soon";
};
