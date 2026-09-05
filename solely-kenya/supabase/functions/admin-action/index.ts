import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";
import { getPlatformSetting } from "../_shared/platform-settings.ts";

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
  | "restore_vendor"
  | "update_platform_setting"
  | "promote_to_admin"
  | "revoke_admin";

interface AdminActionRequest {
  action: AdminAction;
  targetId?: string; // product ID or vendor user ID - not used for update_platform_setting/promote_to_admin/revoke_admin
  key?: string; // platform_settings key - update_platform_setting only
  value?: unknown; // new value - update_platform_setting only
  email?: string; // account to promote/revoke - promote_to_admin/revoke_admin only
  reason?: string; // required for high-risk actions (update_platform_setting, promote_to_admin, revoke_admin)
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
    const { action, targetId, key, value, email, reason }: AdminActionRequest = await req.json();

    if (!action) {
      throw new Error("Missing required field: action");
    }
    const targetIdOptionalActions: AdminAction[] = ["update_platform_setting", "promote_to_admin", "revoke_admin"];
    if (!targetIdOptionalActions.includes(action) && !targetId) {
      throw new Error("Missing required field: targetId");
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

      // ── User Roles ──
      case "promote_to_admin": {
        const normalizedEmail = email?.trim().toLowerCase();
        if (!normalizedEmail) {
          throw new Error("Missing required field: email");
        }
        if (!reason || !reason.trim()) {
          throw new Error("A reason is required for granting admin access");
        }

        const { data: targetProfile } = await serviceClient
          .from("profiles")
          .select("id, full_name, email")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (!targetProfile) {
          throw new Error(`No account found with email ${normalizedEmail} — they need to sign up first`);
        }

        const { data: existingRole } = await serviceClient
          .from("user_roles")
          .select("role")
          .eq("user_id", targetProfile.id)
          .eq("role", "admin")
          .maybeSingle();

        if (existingRole) {
          result.message = `${normalizedEmail} is already an admin`;
          break;
        }

        const { count: adminCount } = await serviceClient
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");

        const maxAdmins = await getPlatformSetting(serviceClient, "max_admins", 3);
        if ((adminCount ?? 0) >= maxAdmins) {
          throw new Error(`Cannot add more admins — the limit is ${maxAdmins}. Remove one first.`);
        }

        // assign_admin_role is locked down to service_role only (see
        // migration 20260904000400) - this is the one legitimate caller.
        const { error: rpcError } = await serviceClient.rpc("assign_admin_role", {
          _user_email: normalizedEmail,
        });
        if (rpcError) throw rpcError;

        const { data: grantedByProfile } = await serviceClient
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        await serviceClient.from("admin_activity_log").insert({
          admin_id: user.id,
          action_type: "promote_to_admin",
          target_type: "user",
          target_id: targetProfile.id,
          vendor_id: null,
          details: { email: normalizedEmail, reason },
        });

        result.message = `${normalizedEmail} is now an admin`;

        if (targetProfile.email) {
          const siteUrl = Deno.env.get("SITE_URL") || "https://solelymarketplace.com";
          const emailResult = await sendEmail({
            to: targetProfile.email,
            subject: "You've Been Added as an Admin on Sole-ly",
            html: emailTemplates.adminGranted({
              recipientName: targetProfile.full_name || "there",
              grantedByName: grantedByProfile?.full_name || "An admin",
              adminUrl: `${siteUrl}/admin`,
            }),
          });
          if (!emailResult.success) {
            console.error("Failed to send admin-granted email:", emailResult.error);
            // Don't fail the whole action over a notification email - the
            // grant itself succeeded - but surface it so the admin isn't
            // left thinking a silent email actually went out.
            result.message += ` (notification email failed to send: ${emailResult.error})`;
          }
        }
        break;
      }

      case "revoke_admin": {
        const normalizedEmail = email?.trim().toLowerCase();
        if (!normalizedEmail) {
          throw new Error("Missing required field: email");
        }
        if (!reason || !reason.trim()) {
          throw new Error("A reason is required for removing admin access");
        }

        const { data: targetProfile } = await serviceClient
          .from("profiles")
          .select("id, full_name, email")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (!targetProfile) {
          throw new Error(`No account found with email ${normalizedEmail}`);
        }

        const { count: adminCount } = await serviceClient
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");

        if ((adminCount ?? 0) <= 1) {
          throw new Error("Cannot remove the last remaining admin");
        }

        const { error, count: deletedCount } = await serviceClient
          .from("user_roles")
          .delete({ count: "exact" })
          .eq("user_id", targetProfile.id)
          .eq("role", "admin");
        if (error) throw error;

        if (!deletedCount) {
          result.message = `${normalizedEmail} was not an admin`;
          break;
        }

        await serviceClient.from("admin_activity_log").insert({
          admin_id: user.id,
          action_type: "revoke_admin",
          target_type: "user",
          target_id: targetProfile.id,
          vendor_id: null,
          details: { email: normalizedEmail, reason },
        });

        result.message = `Removed admin access for ${normalizedEmail}`;
        break;
      }

      // ── Platform Settings ──
      case "update_platform_setting": {
        if (!key || value === undefined) {
          throw new Error("Missing required fields: key, value");
        }
        if (!reason || !reason.trim()) {
          throw new Error("A reason is required for settings changes");
        }

        const { data: previous } = await serviceClient
          .from("platform_settings")
          .select("value")
          .eq("key", key)
          .maybeSingle();

        const { error } = await serviceClient
          .from("platform_settings")
          .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: user.id });
        if (error) throw error;

        // Distinct shape from logActivity: no vendor_id, no real target_id
        // (a setting key isn't a uuid), and the reason is stored alongside
        // the before/after value instead.
        const { error: logError } = await serviceClient.from("admin_activity_log").insert({
          admin_id: user.id,
          action_type: "update_platform_setting",
          target_type: "setting",
          target_id: null,
          vendor_id: null,
          details: { key, previous_value: previous?.value ?? null, new_value: value, reason },
        });
        if (logError) console.error("Failed to record admin activity:", logError);

        result.message = `Setting "${key}" updated`;
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

    // An expired session and a genuinely bad request are very different
    // problems for the caller - one needs a re-login, the other needs the
    // input fixed. Returning 400 for both left the UI unable to tell them
    // apart, so an expired token surfaced as an unexplained failure.
    const isAuthFailure = /^(no authorization header|unauthorized|admin access required)$/i.test(errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error
      }),
      {
        status: isAuthFailure ? 401 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
