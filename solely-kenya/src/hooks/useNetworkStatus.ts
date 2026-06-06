import { useState, useEffect, useCallback } from "react";

interface NetworkStatus {
  /** Whether the browser reports being online */
  isOnline: boolean;
  /** Whether we've confirmed actual internet connectivity (not just LAN) */
  hasInternet: boolean;
  /** Timestamp of last successful connectivity check */
  lastChecked: number | null;
}

/**
 * Detects real internet connectivity — not just navigator.onLine (which only
 * checks if you're connected to a network, not if that network has internet).
 *
 * Uses a lightweight HEAD request to a known-good endpoint to confirm actual
 * connectivity. This is critical in Kenya where users often have WiFi/mobile
 * signal but no actual data.
 */
export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    hasInternet: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastChecked: null,
  });

  // Ping a tiny, fast endpoint to verify real connectivity
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      // Use a tiny favicon from a reliable CDN — fast and doesn't cost bandwidth
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("https://www.google.com/generate_204", {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeout);
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        hasInternet: true,
        lastChecked: Date.now(),
      }));
      return true;
    } catch {
      setStatus((prev) => ({
        ...prev,
        hasInternet: false,
        lastChecked: Date.now(),
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      // Verify actual connectivity when browser says we're back
      checkConnectivity();
    };

    const handleOffline = () => {
      setStatus({
        isOnline: false,
        hasInternet: false,
        lastChecked: Date.now(),
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    checkConnectivity();

    // Periodic check every 30s (lightweight HEAD request)
    const interval = setInterval(checkConnectivity, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkConnectivity]);

  return {
    ...status,
    checkConnectivity,
  };
};
