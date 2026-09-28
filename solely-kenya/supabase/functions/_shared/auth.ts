/**
 * Verified caller identity for edge functions.
 *
 * Never read the user id by base64-decoding the JWT yourself: that accepts a
 * forged token with any `sub`. getUser() asks Supabase Auth to validate the
 * signature and expiry, so it holds even when a function is deployed with
 * --no-verify-jwt.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class AuthError extends Error {
  status = 401;
}

export async function requireUserId(req: Request, supabase: SupabaseClient): Promise<string> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new AuthError("Please sign in and try again.");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new AuthError("Your session has expired. Please sign in again.");

  return data.user.id;
}

/** True only for calls made with the service-role key (cron jobs, other functions). */
export function isServiceCall(req: Request): boolean {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return !!key && req.headers.get("Authorization") === `Bearer ${key}`;
}

export function authErrorResponse(err: unknown, corsHeaders: Record<string, string>): Response | null {
  if (!(err instanceof AuthError)) return null;
  return new Response(JSON.stringify({ success: false, error: err.message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
