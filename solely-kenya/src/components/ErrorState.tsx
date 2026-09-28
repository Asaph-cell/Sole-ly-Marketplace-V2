import { useEffect, useState } from "react";
import { RefreshCw, WifiOff, CloudOff, Lock, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorKind, friendlyError, isRetryable } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Anything thrown or a message string; it's translated for people. */
  error: unknown;
  onRetry?: () => void | Promise<unknown>;
  title?: string;
  className?: string;
  /** Smaller variant for inline sections (e.g. a product row on Home). */
  compact?: boolean;
}

const TITLES: Record<string, string> = {
  offline: "You're offline",
  network: "Connection problem",
  timeout: "Taking too long",
  auth: "Please sign in again",
  not_found: "Not found",
  rate_limit: "Slow down a little",
};

export function ErrorState({ error, onRetry, title, className, compact }: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);
  const kind = errorKind(error);
  const Icon = kind === "offline" || kind === "network" ? WifiOff : kind === "auth" ? Lock : kind === "not_found" ? SearchX : CloudOff;

  const retry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  // Connection errors fix themselves the moment the phone is back online.
  useEffect(() => {
    if (!onRetry || (kind !== "offline" && kind !== "network")) return;
    const onOnline = () => void retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, onRetry]);

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center px-4 animate-fade-in",
        compact ? "py-10" : "min-h-[50vh] py-12",
        className,
      )}
    >
      <div className={cn("rounded-full bg-muted flex items-center justify-center mb-4", compact ? "w-12 h-12" : "w-16 h-16")}>
        <Icon className={cn("text-muted-foreground", compact ? "w-6 h-6" : "w-8 h-8")} strokeWidth={1.5} />
      </div>
      <h2 className={cn("font-bold mb-2", compact ? "text-lg" : "text-xl")}>{title ?? TITLES[kind] ?? "Something went wrong"}</h2>
      <p className="text-muted-foreground mb-6 max-w-sm text-sm sm:text-base">{friendlyError(error)}</p>
      {onRetry && (kind === "auth" ? (
        <Button asChild size="lg">
          <a href={`/auth?redirect=${encodeURIComponent(window.location.pathname)}`}>Sign in</a>
        </Button>
      ) : isRetryable(error) && (
        <Button onClick={retry} size="lg" disabled={retrying} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      ))}
    </div>
  );
}
