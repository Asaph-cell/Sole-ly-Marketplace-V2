import { supabase } from "@/integrations/supabase/client";

const SESSION_EXPIRED = "Your session has expired. Sign out and back in, then try again.";

/**
 * Pulls the real message out of a failed supabase.functions.invoke() call.
 *
 * On a non-2xx response the client only gives you the generic
 * "Edge Function returned a non-2xx status code" - the actual message the
 * function threw is in the unread response body, which has to be pulled off
 * error.context. Without this, a perfectly clear server-side error like
 * "No account found with that email" reaches the user as noise.
 */
export async function edgeErrorMessage(error: any, fallback = "Something went wrong"): Promise<string> {
  if (!error) return fallback;

  let message = error.message || fallback;

  if (error.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
    } catch {
      // body wasn't JSON - fall through to the generic message
    }
  }

  if (error.context?.status === 401 || /^(no authorization header|unauthorized|admin access required)$/i.test(message)) {
    return SESSION_EXPIRED;
  }

  return message;
}

/**
 * Calls the admin-action edge function with the session checked first.
 *
 * getSession() refreshes a token that's expired or close to it, so a long-open
 * admin tab doesn't spend a round trip only to be rejected. Every admin
 * mutation goes through this rather than a bare invoke, so failures surface
 * the function's real message instead of the transport-level one.
 */
export async function invokeAdminAction<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(SESSION_EXPIRED);

  const { data, error } = await supabase.functions.invoke("admin-action", { body });
  if (error) throw new Error(await edgeErrorMessage(error));

  return data as T;
}
