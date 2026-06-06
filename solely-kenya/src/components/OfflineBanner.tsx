import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff, RefreshCw, Signal } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * A top-level banner + overlay that appears when the user has no internet.
 * - Shows a non-dismissable banner at the top of the screen
 * - Includes a retry button that re-checks connectivity
 * - Auto-hides with a success toast when connection is restored
 */
export const OfflineBanner = () => {
  const { isOnline, hasInternet, checkConnectivity } = useNetworkStatus();
  const [checking, setChecking] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  const isOffline = !isOnline || !hasInternet;

  const handleRetry = async () => {
    setChecking(true);
    const connected = await checkConnectivity();
    setChecking(false);

    if (connected) {
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 3000);
    }
  };

  return (
    <AnimatePresence>
      {/* Reconnected success banner */}
      {justReconnected && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-green-600 text-white"
        >
          <div className="container mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium">
            <Signal size={16} strokeWidth={2} />
            <span>You're back online!</span>
          </div>
        </motion.div>
      )}

      {/* Offline banner */}
      {isOffline && !justReconnected && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[9999]"
        >
          {/* Banner */}
          <div className="bg-zinc-900 text-white shadow-2xl">
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center">
                    <WifiOff size={18} strokeWidth={2} className="text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">
                      No internet connection
                    </p>
                    <p className="text-xs text-zinc-400 leading-tight mt-0.5 hidden sm:block">
                      Check your WiFi or mobile data and try again
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRetry}
                  disabled={checking}
                  className="shrink-0 flex items-center gap-1.5 bg-white text-zinc-900 font-semibold text-xs px-3.5 py-2 rounded-full hover:bg-zinc-100 active:scale-95 transition-all disabled:opacity-60"
                >
                  <RefreshCw
                    size={14}
                    strokeWidth={2}
                    className={checking ? "animate-spin" : ""}
                  />
                  {checking ? "Checking..." : "Retry"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
