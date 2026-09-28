/**
 * Fixed-window rate limiting backed by public.rate_limit_hit() (see
 * migrations/20260928000100_rate_limits.sql).
 *
 * Usage, near the top of a handler:
 *
 *   const limited = await rateLimit(req, corsHeaders, { name: "pin", max: 5, windowSeconds: 900, identity: `${userId}:${orderId}` });
 *   if (limited) return limited;
 *
 * Returns a ready 429 Response when the caller is over the limit, else null.
 * With no identity the caller's IP is used.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RateLimitOptions {
  /** Bucket name, e.g. "pin" or "create-order". */
  name: string;
  max: number;
  windowSeconds: number;
  /** User id, user+order, etc. Defaults to the caller's IP. */
  identity?: string;
  /**
   * Block the request if the limiter itself can't be reached. Use for
   * brute-forceable secrets (PINs, OTPs); everything else fails open so a
   * database hiccup never takes checkout down.
   */
  failClosed?: boolean;
}

let client: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (!client) {
    client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }
  return client;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
  return forwarded.split(",")[0].trim();
}

export async function rateLimit(
  req: Request,
  corsHeaders: Record<string, string>,
  opts: RateLimitOptions,
): Promise<Response | null> {
  const bucket = `${opts.name}:${opts.identity ?? `ip:${clientIp(req)}`}`;

  const { data, error } = await serviceClient().rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_max: opts.max,
    p_window_seconds: opts.windowSeconds,
  });

  if (error) {
    console.error(`[rate-limit] ${bucket} check failed:`, error.message);
    return opts.failClosed ? tooMany(corsHeaders, 60) : null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.allowed === false) {
    console.warn(`[rate-limit] blocked ${bucket}`);
    return tooMany(corsHeaders, row.retry_after ?? opts.windowSeconds);
  }
  return null;
}

function tooMany(corsHeaders: Record<string, string>, retryAfter: number): Response {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return new Response(
    JSON.stringify({
      success: false,
      error: `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`,
      code: "RATE_LIMITED",
      retryAfter,
    }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfter) },
    },
  );
}
