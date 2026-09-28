/**
 * Turns whatever was thrown (fetch TypeErrors, Postgres codes, edge-function
 * transport noise) into a sentence a shopper can act on. Messages that are
 * already human, e.g. "No account found with that email" from our own edge
 * functions, pass straight through.
 */

export type ErrorKind = "offline" | "network" | "timeout" | "auth" | "rate_limit" | "not_found" | "permission" | "conflict" | "server" | "unknown";

interface Rule {
  kind: ErrorKind;
  test: RegExp;
  message: string;
}

const RULES: Rule[] = [
  { kind: "rate_limit", test: /rate.?limit|too many (requests|attempts)|status (code )?429|P0429/i, message: "You're going a little fast. Please wait a moment and try again." },
  { kind: "network", test: /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_network|ECONNREFUSED|ENOTFOUND/i, message: "We couldn't reach Solely. Check your internet connection and try again." },
  { kind: "timeout", test: /timeout|timed out|aborterror|signal is aborted/i, message: "This is taking longer than usual. Please try again." },
  { kind: "auth", test: /jwt|session (has )?expired|refresh token|not authenticated|no authorization header|invalid token|^unauthori[sz]ed$|status (code )?401/i, message: "Your session has expired. Please sign in again." },
  { kind: "auth", test: /invalid login credentials/i, message: "That email and password don't match. Please try again." },
  { kind: "auth", test: /email not confirmed/i, message: "Please confirm your email first. Check your inbox for the link." },
  { kind: "conflict", test: /user already registered|already been registered/i, message: "An account with this email already exists. Try signing in instead." },
  { kind: "permission", test: /row-level security|violates row level|permission denied|42501|status (code )?403|^forbidden$/i, message: "You don't have permission to do that." },
  { kind: "conflict", test: /duplicate key|23505/i, message: "This already exists." },
  { kind: "conflict", test: /violates (foreign key|check|not-null) constraint|23503|23514|23502|invalid input syntax|22P02/i, message: "Some of the details aren't valid. Please check and try again." },
  { kind: "not_found", test: /PGRST116|no rows|status (code )?404/i, message: "We couldn't find what you were looking for. It may have been removed." },
  { kind: "server", test: /non-2xx|edge function|internal server error|status (code )?5\d\d|bad gateway|service unavailable|PGRST\d+/i, message: "Something went wrong on our side. Please try again in a moment." },
];

/** Looks like a developer message rather than something written for a person. */
const TECHNICAL = /^\w*(Error|Exception)\b|TypeError|ReferenceError|SyntaxError|undefined|null\b|cannot read propert|is not a function|unexpected token|JSON|stack|at \w+ \(|PGRST|supabase|postgres|sql|relation "|column "|function .*\(|https?:\/\//i;

function rawMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    return String(e.message ?? e.error_description ?? e.error ?? e.msg ?? "");
  }
  return String(err);
}

export function errorKind(err: unknown): ErrorKind {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  const msg = rawMessage(err);
  return RULES.find((r) => r.test.test(msg))?.kind ?? "unknown";
}

export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You're offline. Reconnect to the internet and try again.";
  }

  const msg = rawMessage(err).replace(/^(Error|TypeError):\s*/i, "").trim();
  if (!msg) return fallback;

  const rule = RULES.find((r) => r.test.test(msg));
  if (rule) {
    // Our own rate-limit responses already say how long to wait; keep that.
    if (rule.kind === "rate_limit" && /wait \d+ minute/i.test(msg)) return msg;
    return rule.message;
  }

  // Already written for people (short, plain, no code-ish tokens)? Keep it.
  if (msg.length <= 160 && !TECHNICAL.test(msg)) {
    return /[.!?]$/.test(msg) ? msg : `${msg}.`;
  }

  return fallback;
}

/** True when retrying the same request has a real chance of succeeding. */
export function isRetryable(err: unknown): boolean {
  const k = errorKind(err);
  return k === "offline" || k === "network" || k === "timeout" || k === "server" || k === "rate_limit" || k === "unknown";
}
