const STORAGE_KEY = "solely_first_touch_source";

const KNOWN_SOURCES: { pattern: RegExp; label: string }[] = [
  { pattern: /instagram\.com/i, label: "Instagram" },
  { pattern: /(^|\.)facebook\.com$|(^|\.)fb\.com$/i, label: "Facebook" },
  { pattern: /(^|\.)tiktok\.com$/i, label: "TikTok" },
  { pattern: /whatsapp\.com|wa\.me/i, label: "WhatsApp" },
  { pattern: /(^|\.)twitter\.com$|(^|\.)x\.com$/i, label: "Twitter/X" },
  { pattern: /(^|\.)google\./i, label: "Google" },
  { pattern: /(^|\.)bing\.com$/i, label: "Bing" },
];

function classifySource(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");
    if (utmSource) return utmSource.charAt(0).toUpperCase() + utmSource.slice(1);

    const ref = document.referrer;
    if (!ref) return "Direct";

    const refHost = new URL(ref).hostname;
    if (refHost === window.location.hostname) return "Direct";

    const match = KNOWN_SOURCES.find((s) => s.pattern.test(refHost));
    return match ? match.label : refHost;
  } catch {
    return "Direct";
  }
}

/**
 * Best-effort "how did this visitor first arrive" attribution: captured
 * once per browser (first visit wins, persisted so it survives the
 * multi-page journey to actually signing up later) and read back at
 * signup time. Many mobile in-app browsers (Instagram, TikTok) strip
 * document.referrer entirely, so this under-counts social traffic rather
 * than mis-attributing it - treat it as directional, not exact, and only
 * covers signups from whenever this shipped onward (nothing retroactive).
 */
export function captureFirstTouchSource(): void {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    localStorage.setItem(STORAGE_KEY, classifySource());
  } catch {
    // localStorage unavailable (private mode, etc.) - attribution just won't be captured
  }
}

export function getAttributionSource(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
