import { useState } from "react";
import { Info, X } from "lucide-react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

const DISMISS_KEY = "solely_dismissed_maintenance_banner";

/**
 * The soft counterpart to full maintenance_mode: tells visitors changes are
 * in progress without blocking the site. Dismissible per browser session -
 * keyed by the message text itself, so editing the message in Admin >
 * Settings makes it reappear even for someone who already dismissed the
 * old one.
 */
export const MaintenanceBanner = () => {
  const { data: settings } = usePlatformSettings();
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  if (!settings.maintenanceBannerEnabled || !settings.maintenanceBannerMessage) return null;
  if (dismissedMessage === settings.maintenanceBannerMessage) return null;

  const handleDismiss = () => {
    setDismissedMessage(settings.maintenanceBannerMessage);
    try {
      sessionStorage.setItem(DISMISS_KEY, settings.maintenanceBannerMessage);
    } catch {
      // sessionStorage unavailable - banner will just reappear on next page, not a big deal
    }
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 text-foreground">
      <div className="container mx-auto px-4 py-2 flex items-center gap-2.5 text-xs sm:text-sm">
        <Info size={15} strokeWidth={2} className="text-primary flex-shrink-0" />
        <p className="flex-1 min-w-0">{settings.maintenanceBannerMessage}</p>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 p-1 rounded-full hover:bg-primary/15 transition-colors"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};
