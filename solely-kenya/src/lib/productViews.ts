import { supabase } from "@/integrations/supabase/client";

export type ViewSource = "buy_link" | "product_page" | "storefront";

const VISITOR_KEY = "solely_visitor_id";
// One view per product per visitor per window. Without this a vendor's numbers
// are dominated by their own refreshes and by anyone who taps back and forth.
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/**
 * An opaque random id kept in this browser only. Deliberately not tied to an
 * account and not derived from IP, user agent or anything else personal - its
 * whole job is telling "ten people looked" apart from "one person refreshed
 * ten times", which is the difference between a number and a decision.
 */
function getVisitorId(): string | null {
    try {
        let id = localStorage.getItem(VISITOR_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(VISITOR_KEY, id);
        }
        return id;
    } catch {
        // Private mode, or storage blocked. The view still counts, it just
        // can't be de-duplicated.
        return null;
    }
}

function seenRecently(productId: string): boolean {
    try {
        const key = `solely_viewed_${productId}`;
        const last = Number(localStorage.getItem(key) || 0);
        if (Date.now() - last < DEDUPE_WINDOW_MS) return true;
        localStorage.setItem(key, String(Date.now()));
        return false;
    } catch {
        return false;
    }
}

/**
 * Record a product view. Fire-and-forget: analytics must never block or break
 * the page a buyer is trying to use, so every failure is swallowed.
 */
export async function recordProductView(productId: string, source: ViewSource): Promise<void> {
    if (!productId) return;
    if (seenRecently(productId)) return;

    try {
        await supabase.from("product_views").insert({
            product_id: productId,
            source,
            visitor_id: getVisitorId(),
        });
    } catch {
        /* ignore - a missed view is not worth a broken page */
    }
}
