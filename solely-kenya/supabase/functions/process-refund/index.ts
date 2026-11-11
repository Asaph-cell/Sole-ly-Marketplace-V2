/**
 * Process Refund (admin)
 *
 * Lets an admin refund an order by hand. The IntaSend chargeback and all
 * the bookkeeping live in _shared/order-money.ts (refundOrder), which the
 * dispute system's own refunds also use - internal callers call that
 * directly rather than going through this endpoint.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refundOrder } from "../_shared/order-money.ts";
import { UserError } from "../_shared/errors.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

        // ── SECURITY: Verify caller is an authenticated admin ──────────────────
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);

        const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
        if (authError || !user) return json({ success: false, error: "Unauthorized" }, 401);

        const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: adminRole } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();
        if (!adminRole) {
            console.warn(`[Refund] Non-admin user ${user.id} attempted to call process-refund`);
            return json({ success: false, error: "Forbidden: admin access required" }, 403);
        }
        // ── END SECURITY ───────────────────────────────────────────────────────

        const { orderId, reason, refundAmount } = await req.json();
        if (!orderId) return json({ success: false, error: "orderId is required" }, 400);

        console.log(`[Refund] Admin ${user.id} refunding order ${orderId}`);
        const result = await refundOrder(supabase, orderId, {
            amount: refundAmount ? Number(refundAmount) : undefined,
            reason: reason || "other",
        });

        return json({ success: true, message: "Refund initiated successfully", ...result });
    } catch (error) {
        console.error("[Refund] Error:", error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : "Refund processing failed",
        }, error instanceof UserError ? 409 : 500);
    }
});
