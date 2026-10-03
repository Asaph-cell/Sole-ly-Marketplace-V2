/**
 * Client side of AI help when listing an item. The model only suggests; the
 * seller reviews every field. When Solely's AI budget runs out (or the key
 * isn't set) the server says so and the form simply hides the AI buttons.
 */
import { supabase } from "@/integrations/supabase/client";
import { ALL_CATEGORIES } from "@/lib/categories";

export interface AiListingFields {
  category: string;
  subcategory: string;
  name: string;
  brand: string;
  description: string;
  key_features: string[];
  colors: string[];
  /** "new" | "thrifted" | "refurbished", or "" when the photos don't say. */
  condition: string;
  /** Which of brand / colour / condition / size the model wasn't sure about. */
  uncertain: string[];
}

export type AiFillResult =
  | { ok: true; fields: AiListingFields }
  | { ok: false; unavailable: boolean; message: string };

const FALLBACK = "AI help isn't available right now. Fill in the details yourself.";

/**
 * Off until VITE_AI_LISTING=true is set at build time, so nothing calls the
 * server (or shows a button) before the edge function is deployed and keyed.
 */
const AI_LISTING_ENABLED = import.meta.env.VITE_AI_LISTING === "true";

/** Is AI help switched on and still under its budget? Any failure means "no". */
export const aiListingStatus = async (): Promise<boolean> => {
  if (!AI_LISTING_ENABLED) return false;
  try {
    const { data, error } = await supabase.functions.invoke("ai-listing-assist", { body: { action: "status" } });
    return !error && data?.available === true;
  } catch {
    return false;
  }
};

/** The server's own message for a failed call, when it sent one. */
const serverMessage = async (error: any): Promise<string | null> => {
  try {
    const body = await error?.context?.json?.();
    return typeof body?.error === "string" ? body.error : null;
  } catch {
    return null;
  }
};

export const aiListingFill = async (images: string[], hint: string): Promise<AiFillResult> => {
  try {
    const { data, error } = await supabase.functions.invoke("ai-listing-assist", {
      body: {
        action: "fill",
        images: images.slice(0, 2),
        hint,
        categories: ALL_CATEGORIES.map((c) => ({ key: c.key, subs: c.subcategories.map((s) => s.key) })),
      },
    });
    if (error) return { ok: false, unavailable: false, message: (await serverMessage(error)) ?? FALLBACK };
    if (!data?.available) return { ok: false, unavailable: true, message: FALLBACK };
    if (!data.fields) return { ok: false, unavailable: false, message: data?.error ?? FALLBACK };
    return { ok: true, fields: data.fields as AiListingFields };
  } catch {
    return { ok: false, unavailable: false, message: FALLBACK };
  }
};
