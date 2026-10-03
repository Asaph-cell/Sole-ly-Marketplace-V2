/**
 * Usage of seller websites: what visitors do (logged for the seller and for
 * Solely), and the free-spots limit for switching a website on.
 */
import { supabase } from "@/integrations/supabase/client";

export type SiteEventKind = "visit" | "buy_click" | "whatsapp_click";

const VISITOR_KEY = "solely_visitor_id";
// One "visit" per website per visitor per window, so a refresh isn't a new visitor.
const VISIT_WINDOW_MS = 30 * 60 * 1000;

const visitorId = (): string | null => {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
};

const seenRecently = (vendorId: string): boolean => {
  try {
    const key = `solely_site_visit_${vendorId}`;
    if (Date.now() - Number(sessionStorage.getItem(key) || 0) < VISIT_WINDOW_MS) return true;
    sessionStorage.setItem(key, String(Date.now()));
    return false;
  } catch {
    return false;
  }
};

/** Fire-and-forget: counting must never slow down or break the website. */
export const recordSiteEvent = (vendorId: string, kind: SiteEventKind) => {
  if (!vendorId) return;
  if (kind === "visit" && seenRecently(vendorId)) return;
  void Promise.resolve((supabase as any).from("store_site_events").insert({ vendor_id: vendorId, kind, visitor_id: visitorId() })).catch(() => {});
};

// ── Free spots ─────────────────────────────────────────────────────────────

export interface FreeSlots {
  limit: number;
  taken: number;
  /** This seller already holds a free spot. */
  mine: boolean;
}

export const fetchFreeSlots = async (): Promise<FreeSlots | null> => {
  const { data, error } = await (supabase as any).rpc("website_free_slots");
  if (error || !data) return null;
  return { limit: Number(data.limit), taken: Number(data.taken), mine: !!data.mine };
};

/** True when a save failed only because the free spots ran out. */
export const isSpotsFull = (error: { message?: string; code?: string } | null | undefined) =>
  !!error && (error.code === "P0402" || /WEBSITE_FREE_SPOTS_FULL/.test(error.message ?? ""));

export const joinWebsiteWaitlist = async (vendorId: string): Promise<boolean> => {
  const { error } = await (supabase as any).from("store_site_waitlist").upsert({ vendor_id: vendorId }, { onConflict: "vendor_id", ignoreDuplicates: true });
  return !error;
};

export const onWebsiteWaitlist = async (vendorId: string): Promise<boolean> => {
  const { data } = await (supabase as any).from("store_site_waitlist").select("vendor_id").eq("vendor_id", vendorId).maybeSingle();
  return !!data;
};
