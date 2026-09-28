/**
 * Notify Price Drop
 *
 * Tells buyers who tapped "Notify me on price drop" that an item got cheaper.
 * Called by the vendor edit pages right after a seller saves a lower price
 * ({ productId }). Called with no productId it sweeps every product; a daily
 * pg_cron job does this to catch drops made any other way.
 *
 * Each alert fires once: it is marked notified and switched off, and the buyer
 * can switch it back on from the product page.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimit } from "../_shared/rate-limit.ts";
import { sendEmail, baseEmailLayout } from "../_shared/email-service.ts";
import { isServiceCall, requireUserId, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://solelymarketplace.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ksh = (n: number) => `KES ${Math.round(n).toLocaleString("en-US")}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const limited = await rateLimit(req, corsHeaders, { name: "notify-price-drop", max: 60, windowSeconds: 60 });
  if (limited) return limited;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const productId: string | undefined = body?.productId;
    const service = isServiceCall(req);

    // A single-product check is for the seller who owns it. The full sweep (no
    // productId) is open so the daily cron can call it with the public anon
    // key: it only notifies genuine drops, each alert fires once, and it's
    // rate-limited, so calling it early just delivers alerts sooner.
    if (!service && productId) {
      const userId = await requireUserId(req, supabase);
      const { data: owned } = await supabase
        .from("products").select("id").eq("id", productId).eq("vendor_id", userId).maybeSingle();
      if (!owned) return json({ error: "Not your product" }, 403);
    }

    let query = supabase
      .from("price_alerts")
      .select("id, user_id, original_price, target_price, product:products!inner(id, name, price_ksh, images, status)")
      .eq("is_active", true)
      .is("notified_at", null);
    if (productId) query = query.eq("product_id", productId);

    const { data: alerts, error } = await query;
    if (error) throw error;

    // A drop is below the price when the alert was set, or at/below the buyer's target.
    const due = (alerts || []).filter((a: any) => {
      const p = a.product;
      if (!p || p.status !== "active") return false;
      return a.target_price != null ? p.price_ksh <= a.target_price : p.price_ksh < a.original_price;
    });

    let sent = 0;
    for (const alert of due as any[]) {
      const p = alert.product;
      const url = `${SITE_URL}/product/${p.id}`;
      const saved = Math.max(0, alert.original_price - p.price_ksh);
      const title = `Price drop: ${p.name}`;
      const message = `Now ${ksh(p.price_ksh)}${saved > 0 ? `, ${ksh(saved)} less than when you asked us to watch it` : ""}.`;

      // Claim the alert first so two runs can't notify twice.
      const { data: claimed } = await supabase
        .from("price_alerts")
        .update({ notified_at: new Date().toISOString(), is_active: false })
        .eq("id", alert.id)
        .is("notified_at", null)
        .select("id");
      if (!claimed?.length) continue;

      // Push (best effort)
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ userId: alert.user_id, title, body: message, url: `/product/${p.id}` }),
        });
      } catch (e) {
        console.warn("Push failed:", e);
      }

      // In-app notification (best effort)
      try {
        await supabase.from("notifications").insert({
          user_id: alert.user_id,
          type: "price_drop",
          title,
          message,
          related_id: p.id,
        });
      } catch (_) { /* table optional */ }

      // Email (best effort)
      try {
        const { data: u } = await supabase.auth.admin.getUserById(alert.user_id);
        const email = u?.user?.email;
        if (email) {
          const image = Array.isArray(p.images) && p.images[0]
            ? `<img src="${p.images[0]}" alt="" width="280" style="max-width:100%;border-radius:12px;margin:0 0 16px" />`
            : "";
          await sendEmail({
            to: email,
            subject: `${p.name} is now ${ksh(p.price_ksh)}`,
            html: baseEmailLayout(
              "Price drop on an item you're watching",
              `${image}
               <p style="font-size:16px;margin:0 0 8px"><strong>${p.name}</strong></p>
               <p style="margin:0 0 4px">Now <strong>${ksh(p.price_ksh)}</strong>
                 <span style="color:#888;text-decoration:line-through;margin-left:6px">${ksh(alert.original_price)}</span></p>
               <p style="margin:16px 0 24px;color:#555">Your payment is held by Solely until the order arrives.</p>
               <a href="${url}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">View the item</a>
               <p style="margin:24px 0 0;font-size:12px;color:#888">You asked us to tell you about price drops on this item. We've switched the alert off; turn it on again from the product page any time.</p>`,
            ),
          });
        }
      } catch (e) {
        console.warn("Email failed:", e);
      }

      sent++;
    }

    return json({ success: true, checked: alerts?.length || 0, notified: sent });
  } catch (err) {
    const authResponse = authErrorResponse(err, corsHeaders);
    if (authResponse) return authResponse;
    console.error("notify-price-drop error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
