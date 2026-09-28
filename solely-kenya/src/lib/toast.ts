/**
 * Drop-in for `import { toast } from "sonner"`.
 *
 * Every error toast passes through friendlyError(), so a stray
 * `toast.error(error.message)` can never show "TypeError: Failed to fetch"
 * to a shopper. Pass `retry` to put a "Try again" button on the toast.
 */
import type { ReactNode } from "react";
import { toast as sonner, type ExternalToast } from "sonner";
import { friendlyError, isRetryable } from "@/lib/friendlyError";

type ErrorOptions = ExternalToast & { retry?: () => void };

function error(message: unknown, opts: ErrorOptions = {}) {
  const { retry, ...rest } = opts;
  const text = typeof message === "string" || message instanceof Error || (message && typeof message === "object" && !("$$typeof" in (message as object)))
    ? friendlyError(message)
    : (message as ReactNode);
  const description = typeof rest.description === "string" ? friendlyError(rest.description, rest.description) : rest.description;

  return sonner.error(text as ReactNode, {
    ...rest,
    description,
    action: rest.action ?? (retry && isRetryable(message) ? { label: "Try again", onClick: retry } : undefined),
  });
}

export const toast = Object.assign((...args: Parameters<typeof sonner>) => sonner(...args), sonner, { error });
