import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminAction =
  | "pause_product"
  | "restore_product"
  | "delete_product"
  | "penalize_vendor"
  | "revoke_vendor"
  | "restore_vendor";

interface AdminActionRequest {
  action: AdminAction;
  targetId: string; // product ID or vendor user ID
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the caller is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: adminRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminRole) {
      throw new Error("Admin access required");
    }

    // Parse request
    const { action, targetId }: AdminActionRequest = await req.json();

    if (!action || !targetId) {
      throw new Error("Missing required fields: action, targetId");
    }

    let result: any = { success: true };

    // Records an audit-log row after a mutation succeeds. Never throws -
    // a logging failure shouldn't fail an otherwise-successful admin action.
    const logActivity = async (
      actionType: string,
      targetType: "product" | "vendor" | "dispute",
      vendorId: string | null,
      details: Record<string, unknown>
    ) => {
      const { error } = await serviceClient.from("admin_activity_log").insert({
        admin_id: user.id,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        vendor_id: vendorId,
        details,
      });
      if (error) console.error("Failed to record admin activity:", error);
    };

    switch (action) {
      // ── Product Actions ──
      case "pause_product": {
        const { data: product } = await serviceClient
          .from("products")
          .select("name, vendor_id, status")
          .eq("id", targetId)
          .single();

        const { error } = await serviceClient
          .from("products")
          .update({ status: "paused" })
          .eq("id", targetId);
        if (error) throw error;

        await logActivity("pause_product", "product", product?.vendor_id ?? null, {
          product_name: product?.name,
          previous_status: product?.status,
          new_status: "paused",
        });
        result.message = "Product paused successfully";
        break;
      }

      case "restore_product": {
        const { data: product } = await serviceClient
          .from("products")
          .select("name, vendor_id, status")
          .eq("id", targetId)
          .single();

        const { error } = await serviceClient
          .from("products")
          .update({ status: "active" })
          .eq("id", targetId);
        if (error) throw error;

        await logActivity("restore_product", "product", product?.vendor_id ?? null, {
          product_name: product?.name,
          previous_status: product?.status,
          new_status: "active",
        });
        result.message = "Product restored successfully";
        break;
      }

      case "delete_product": {
        // Must read before deleting - the row is gone afterward and this is
        // the only chance to capture what it was for the log.
        const { data: product } = await serviceClient
          .from("products")
          .select("name, vendor_id, price_ksh, status")
          .eq("id", targetId)
          .single();

        const { error } = await serviceClient
          .from("products")
          .delete()
          .eq("id", targetId);
        if (error) throw error;

        await logActivity("delete_product", "product", product?.vendor_id ?? null, {
          product_name: product?.name,
          price_ksh: product?.price_ksh,
          previous_status: product?.status,
        });
        result.message = "Product deleted successfully";
        break;
      }

      // ── Vendor Actions ──
      case "penalize_vendor": {
        const { data: vendor } = await serviceClient
          .from("profiles")
          .select("full_name, store_name")
          .eq("id", targetId)
          .single();

        const { error } = await serviceClient
          .from("vendor_ratings")
          .insert({
            vendor_id: targetId,
            buyer_id: user.id,
            order_id: "00000000-0000-0000-0000-000000000000",
            rating: 1,
            review: "System Penalty: Violation of marketplace rules or vendor misconduct.",
          });
        if (error) throw error;

        await logActivity("penalize_vendor", "vendor", targetId, {
          vendor_name: vendor?.store_name || vendor?.full_name,
          rating_inserted: 1,
        });
        result.message = "Vendor penalized with 1-star rating";
        break;
      }

      case "revoke_vendor": {
        const { data: vendor } = await serviceClient
          .from("profiles")
          .select("full_name, store_name")
          .eq("id", targetId)
          .single();

        // Swap the role rather than deleting it, so the vendor stays visible
        // (marked revoked) in AdminVendors.tsx instead of vanishing with no
        // way to find/restore them.
        const { error } = await serviceClient
          .from("user_roles")
          .update({ role: "revoked_vendor" })
          .eq("user_id", targetId)
          .eq("role", "vendor");

        if (error) throw error;

        await logActivity("revoke_vendor", "vendor", targetId, {
          vendor_name: vendor?.store_name || vendor?.full_name,
          previous_role: "vendor",
          new_role: "revoked_vendor",
        });
        result.message = "Vendor access revoked";
        break;
      }

      case "restore_vendor": {
        const { data: vendor } = await serviceClient
          .from("profiles")
          .select("full_name, store_name")
          .eq("id", targetId)
          .single();

        const { error } = await serviceClient
          .from("user_roles")
          .update({ role: "vendor" })
          .eq("user_id", targetId)
          .eq("role", "revoked_vendor");

        if (error) throw error;

        await logActivity("restore_vendor", "vendor", targetId, {
          vendor_name: vendor?.store_name || vendor?.full_name,
          previous_role: "revoked_vendor",
          new_role: "vendor",
        });
        result.message = "Vendor access restored";
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in admin-action:", error);
    
    // Supabase errors are objects with a message property, not necessarily instances of Error
    const errorMessage = error?.message || (typeof error === "string" ? error : "Unknown error");
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
