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

  if (error.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // body wasn't JSON - fall through to the generic message
    }
  }

  return error.message || fallback;
}
