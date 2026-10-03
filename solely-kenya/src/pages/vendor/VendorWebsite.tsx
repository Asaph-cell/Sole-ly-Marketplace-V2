/**
 * "My website": a seller turns their store page into their own website and
 * edits it: look and colours, their words and photos, and the order of the
 * page. The preview beside the controls is the real website in an iframe,
 * fed unsaved settings as they change.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { FormSkeleton } from "@/components/skeletons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import {
  ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, ExternalLink, Globe, ImagePlus, Laptop, Loader2, Plus, Smartphone,
  Sparkles, Trash2, X,
} from "lucide-react";
import {
  DEFAULT_SETTINGS, PREVIEW_MESSAGE, SECTION_LABELS, liveOffer, settingsFromRow, type CardStyle, type Corners,
  type Faq, type HeadingWeight, type HeroStyle, type SiteSettings, type TextScale, type ThemeId,
} from "@/lib/storeSite";
import { CARD_STYLES, CORNERS, HERO_STYLES, THEME_LIST, THEMES, loadThemeFonts } from "@/pages/site/templates";
import { writeDraft } from "@/pages/site/StorePage";
import {
  fetchFreeSlots, isSpotsFull, joinWebsiteWaitlist, onWebsiteWaitlist, type FreeSlots,
} from "@/lib/siteUsage";

const HEX_RE = /^#[0-9a-f]{6}$/i;
type Tab = "look" | "content" | "layout" | "offers";

const MAX_OFFER_DAYS = 30;
const STARTER_FAQS: Faq[] = [
  { q: "How does delivery work?", a: "We deliver to you. Agree the delivery fee with us in chat before you pay, and we'll confirm when your order is on its way." },
  { q: "Is it safe to pay?", a: "Yes. You pay with M-Pesa through Solely, which holds your money and only pays us after your order arrives. If it never comes, you get a full refund." },
  { q: "Can I return something?", a: "If an item isn't as described, tell us within 24 hours of getting it and we'll sort it out through Solely." },
];

/** An ISO time as the "2026-10-09T18:00" a datetime-local box wants, in the seller's own timezone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const endOfDayIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
};

// ── Live preview ───────────────────────────────────────────────────────────

const Preview = ({ storeLink, settings }: { storeLink: string; settings: SiteSettings }) => {
  const [mode, setMode] = useState<"phone" | "desktop">("phone");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(400);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: PREVIEW_MESSAGE, settings: settingsRef.current }, window.location.origin);
  }, []);

  useEffect(() => {
    send();
    writeDraft(storeLink, settings);
  }, [settings, send, storeLink]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === `${PREVIEW_MESSAGE}:ready`) send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send]);

  useEffect(() => {
    if (!boxRef.current) return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  const frameW = mode === "phone" ? 390 : 1280;
  const frameH = mode === "phone" ? 760 : 820;
  const scale = Math.min(1, boxWidth / frameW);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Preview</p>
        <div className="inline-flex rounded-full border bg-background p-1" role="group" aria-label="Preview size">
          {([["phone", Smartphone, "Phone"], ["desktop", Laptop, "Computer"]] as const).map(([m, Icon, label]) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
              className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div ref={boxRef} className="w-full">
        <div className="mx-auto overflow-hidden rounded-[22px] border-[6px] border-foreground/90 bg-background shadow-xl"
          style={{ width: frameW * scale + 12, height: frameH * scale + 12 }}>
          <iframe ref={frameRef} title="Website preview" src={`/site-preview/${storeLink}`} onLoad={send}
            // index.css caps every iframe at max-width: 100%, which would squeeze the
            // 1280px "Computer" frame down to the box width and lay the site out as a phone.
            style={{ width: frameW, height: frameH, maxWidth: "none", maxHeight: "none", transform: `scale(${scale})`, transformOrigin: "0 0", border: 0 }} />
        </div>
      </div>
    </div>
  );
};

// ── Small controls ─────────────────────────────────────────────────────────

const Block = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div>
      <h3 className="font-semibold">{title}</h3>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </section>
);

/** A row of choices where the first (null) means "the style's own". */
function Segmented<T extends string | null>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { id: T; name: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-full border bg-background p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}
          className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${value === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

/** Pick a colour from a few safe ones or anything, or go back to the style's own. */
const ColorChoice = ({ label, value, onChange, swatches }: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  swatches: string[];
}) => (
  <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
    <button type="button" onClick={() => onChange(null)} aria-pressed={!value}
      className={`h-9 px-3 rounded-full border text-xs font-medium ${!value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
      Style's own
    </button>
    {swatches.map((c) => (
      <button key={c} type="button" onClick={() => onChange(c)} aria-label={`Use ${c}`} aria-pressed={value?.toLowerCase() === c}
        className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-background transition-shadow ${value?.toLowerCase() === c ? "ring-2 ring-foreground" : ""}`}
        style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />
    ))}
    <label className="relative h-9 w-9 rounded-full overflow-hidden cursor-pointer" title="Any colour">
      <span className="sr-only">Pick any colour for {label}</span>
      <span className="absolute inset-0" style={{ background: "conic-gradient(#ef4444,#f59e0b,#84cc16,#06b6d4,#6366f1,#ec4899,#ef4444)" }} />
      <input type="color" value={value || "#111827"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
    </label>
  </div>
);

const SIZE_OPTIONS: { id: TextScale | null; name: string }[] = [
  { id: "small", name: "Smaller" }, { id: null, name: "Standard" }, { id: "large", name: "Larger" }, { id: "xlarge", name: "Largest" },
];
const TEXT_SWATCHES = ["#111827", "#3f3f46", "#78350f", "#14532d", "#1e3a8a", "#ffffff"];

const HeroIcon = ({ id }: { id: HeroStyle }) => {
  const b = "bg-muted-foreground/35 rounded-[2px]";
  const t = "bg-foreground/70 rounded-[1px]";
  switch (id) {
    case "mosaic": return <div className="grid grid-cols-5 gap-1 h-full"><div className="col-span-2 flex flex-col justify-center gap-1"><div className={`${t} h-1.5 w-full`} /><div className={`${t} h-1 w-2/3`} /></div><div className={`${b} col-span-2`} /><div className="grid gap-1"><div className={b} /><div className={b} /></div></div>;
    case "portrait": return <div className="grid grid-cols-5 gap-1 h-full items-end"><div className={`${b} col-span-3 h-full`} /><div className="col-span-2 space-y-1 pb-1"><div className={`${t} h-2 w-full`} /><div className={`${t} h-1 w-2/3`} /></div></div>;
    case "fullbleed": return <div className={`${b} h-full w-full relative`}><div className={`${t} absolute left-1.5 bottom-1.5 h-2 w-1/2`} /></div>;
    case "marquee": return <div className="h-full flex flex-col justify-between"><div className={`${t} h-3.5 w-[140%] -ml-4`} /><div className="flex gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={`${b} h-4 flex-1`} />)}</div></div>;
    case "arch": return <div className="flex h-full items-end justify-center gap-1.5"><div className={`${b} w-5 h-full`} style={{ borderRadius: "999px 999px 2px 2px" }} /><div className={`${b} w-4 h-3/4`} style={{ borderRadius: "999px 999px 2px 2px" }} /></div>;
    case "collage": return <div className="relative h-full"><div className={`${b} absolute right-0 top-0 h-3/4 w-3/5`} /><div className={`${t} absolute left-0 bottom-0 h-1/2 w-2/5 opacity-60`} /><div className="absolute left-0 top-1 h-1.5 w-1/3 bg-foreground/70" /></div>;
    case "banner": return <div className="h-full rounded-[3px] bg-foreground/80 p-1.5 flex items-end justify-between"><div className="space-y-1 w-1/2"><div className="h-1.5 w-full bg-background/80" /><div className="h-1 w-2/3 bg-background/60" /></div><div className="flex gap-0.5">{[0, 1, 2].map((i) => <div key={i} className="h-3.5 w-2.5 bg-background/70 rounded-[1px]" />)}</div></div>;
    case "type": return <div className="relative h-full flex items-center"><div className={`${t} h-4 w-full`} /><div className={`${b} absolute left-2 top-0 h-4 w-4 rotate-[-8deg]`} /><div className={`${b} absolute right-3 bottom-0 h-4 w-4 rotate-[7deg]`} /></div>;
    case "line": return <div className="relative h-full"><div className={`${t} h-1 w-1/2 mx-auto`} /><svg viewBox="0 0 100 20" className="w-full h-3 mt-1 text-muted-foreground" preserveAspectRatio="none"><path d="M0 2 Q50 22 100 2" stroke="currentColor" fill="none" strokeWidth="2" /></svg><div className="flex justify-around -mt-1">{[0, 1, 2].map((i) => <div key={i} className={`${b} h-4 w-3`} />)}</div></div>;
    default: return <div className="grid grid-cols-2 gap-1 h-full items-center"><div className="space-y-1"><div className={`${t} h-1.5 w-full`} /><div className={`${t} h-1 w-2/3`} /></div><div className="h-full rounded-[2px] border border-muted-foreground/40 flex items-center justify-center"><div className={`${b} h-3 w-4`} /></div></div>;
  }
};

// ── Page ───────────────────────────────────────────────────────────────────

const VendorWebsite = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [storeLink, setStoreLink] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [hasRow, setHasRow] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<string>(JSON.stringify(DEFAULT_SETTINGS));
  const [tab, setTab] = useState<Tab>("look");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [founding, setFounding] = useState(false);
  const [slots, setSlots] = useState<FreeSlots | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: row }, freeSlots, onList] = await Promise.all([
        supabase.from("profiles").select("store_link").eq("id", user.id).single(),
        (supabase as any).from("store_sites").select("*").eq("vendor_id", user.id).maybeSingle(),
        fetchFreeSlots(),
        onWebsiteWaitlist(user.id),
      ]);
      setStoreLink(prof?.store_link ?? null);
      setSlots(freeSlots);
      setWaitlisted(onList);
      if (row) {
        const s = settingsFromRow(row);
        setSettings(s);
        setSaved(JSON.stringify(s));
        setEnabled(!!row.enabled);
        setFounding(!!row.founding);
        setHasRow(true);
      }
      setFetching(false);
    })();
  }, [user]);

  const dirty = JSON.stringify(settings) !== saved;
  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const theme = THEMES[settings.theme];
  const pal = theme.palettes[settings.palette] ?? theme.palettes[0];
  const liveUrl = storeLink ? `${window.location.origin}/store/${storeLink}` : "";

  const persist = async (extra: { enabled?: boolean } = {}) => {
    if (!user) return false;
    if ((settings.text_color && !HEX_RE.test(settings.text_color)) || (settings.heading_color && !HEX_RE.test(settings.heading_color))) {
      toast.error("Pick the text and heading colours from the list, or use the colour wheel.");
      return false;
    }
    if (settings.accent_color && !HEX_RE.test(settings.accent_color)) {
      toast.error("Pick a colour from the list, or type one like #1f6f5c.");
      return false;
    }
    const clean = (v: string | null) => v?.trim() || null;
    const offerTitle = clean(settings.offer_title);
    if (offerTitle) {
      const end = settings.offer_ends_at ? new Date(settings.offer_ends_at).getTime() : NaN;
      if (Number.isNaN(end)) { toast.error("Pick when your offer ends."); setTab("offers"); return false; }
      if (end <= Date.now()) { toast.error("Your offer's end time has already passed. Pick a later one."); setTab("offers"); return false; }
      if (end > Date.now() + MAX_OFFER_DAYS * 86400_000) { toast.error(`Offers can run for up to ${MAX_OFFER_DAYS} days.`); setTab("offers"); return false; }
    }
    // settings can carry the whole row it was loaded from. The switch, the free
    // spot and the timestamps belong to the server: sending a stale `enabled`
    // would flip the website back on or off every time the seller saved.
    const { enabled: _e, founding: _f, first_enabled_at: _fe, created_at: _c, updated_at: _u, vendor_id: _v, ...editable } = settings as SiteSettings & Record<string, unknown>;
    const payload = {
      vendor_id: user.id,
      ...editable,
      tagline: clean(settings.tagline),
      about: clean(settings.about),
      announcement: clean(settings.announcement),
      instagram: clean(settings.instagram),
      tiktok: clean(settings.tiktok),
      hero_title: clean(settings.hero_title),
      cta_text: clean(settings.cta_text),
      offer_title: offerTitle,
      offer_text: offerTitle ? clean(settings.offer_text) : null,
      offer_ends_at: offerTitle ? settings.offer_ends_at : null,
      faqs: settings.faqs.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q && f.a),
      ...extra,
    };
    const { error } = await (supabase as any).from("store_sites").upsert(payload, { onConflict: "vendor_id" });
    if (error) {
      if (isSpotsFull(error)) {
        toast.error("The free website spots have just been taken, so your website can't go live yet. You can still build it.");
        fetchFreeSlots().then(setSlots);
      } else {
        toast.error("Couldn't save your website. Check your connection and try again.");
      }
      return false;
    }
    setSaved(JSON.stringify(settings));
    setHasRow(true);
    return true;
  };

  const save = async () => {
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (ok) toast.success(enabled ? "Changes published" : "Changes saved");
  };

  const toggleLive = async (on: boolean) => {
    setSaving(true);
    const ok = await persist({ enabled: on });
    setSaving(false);
    if (!ok) return;
    setEnabled(on);
    if (on) {
      // Switching on is what takes a free spot, so read back what we hold.
      const [freeSlots, row] = await Promise.all([
        fetchFreeSlots(),
        (supabase as any).from("store_sites").select("founding").eq("vendor_id", user!.id).maybeSingle(),
      ]);
      setSlots(freeSlots);
      setFounding(!!row.data?.founding);
    }
    toast.success(on ? "Your website is live" : "Your website is off. Buyers see your standard store page.");
  };

  const joinWaitlist = async () => {
    if (!user) return;
    const ok = await joinWebsiteWaitlist(user.id);
    if (ok) { setWaitlisted(true); toast.success("You're on the list. We'll tell you when plans are ready."); }
    else toast.error("Couldn't add you to the list. Try again in a moment.");
  };

  // The free spots are gone and this seller doesn't hold one: they can build,
  // but not switch on.
  const spotsFull = !!slots && !founding && !enabled && slots.taken >= slots.limit;

  /** Uploads one photo and returns its public link, or null (after telling the seller). */
  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    if (!file.type.startsWith("image/")) { toast.error("Choose a photo file."); return null; }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/website-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from("store-logos").upload(path, file, { contentType: file.type });
    if (error) { toast.error("Couldn't upload that photo. Try a smaller one."); return null; }
    return supabase.storage.from("store-logos").getPublicUrl(path).data.publicUrl;
  };

  const uploadBanner = async (file: File) => {
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (url) set("banner_url", url);
  };

  const addGalleryPhotos = async (files: FileList) => {
    const room = 8 - settings.gallery.length;
    if (room <= 0) { toast.error("The gallery holds up to 8 photos. Remove one to add another."); return; }
    setUploading(true);
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      const u = await uploadImage(f);
      if (u) urls.push(u);
    }
    setUploading(false);
    if (urls.length) setSettings((s) => ({ ...s, gallery: [...s.gallery, ...urls].slice(0, 8) }));
  };

  const setFaq = (i: number, patch: Partial<Faq>) =>
    set("faqs", settings.faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const offerNow = liveOffer(settings);

  const moveSection = (i: number, dir: -1 | 1) => {
    const list = [...settings.sections];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set("sections", list);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading || fetching) return <FormSkeleton fields={6} />;

  return (
    <div className="min-h-screen bg-muted/30">
      <VendorNavbar />
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 min-w-0 p-4 md:p-8 pb-36">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My website</h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Turn your store page into your own website: your look, your colours, your story. It lives at your store link, so share it on Instagram, TikTok and WhatsApp. Buyers still pay safely through Solely.
              </p>
            </div>

            {!storeLink ? (
              <div className="rounded-2xl border bg-card p-6 space-y-3">
                <p>Finish setting up your shop first, so your website has a name and a link.</p>
                <Button asChild><Link to="/vendor/setup">Set up my shop</Link></Button>
              </div>
            ) : (
              <>
                {/* Live switch + link */}
                <div className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${enabled ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900" : "bg-card"}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch checked={enabled} onCheckedChange={toggleLive} disabled={saving || spotsFull} aria-label="Show my website to buyers" />
                    <div className="min-w-0">
                      <p className="font-semibold flex items-center gap-2 flex-wrap">
                        {enabled ? "Your website is live" : hasRow ? "Your website is off" : "Show my website to buyers"}
                        <span title="This feature is new and still being improved. Things may change."
                          className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          Experimental
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{liveUrl.replace(/^https?:\/\//, "")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                      {copied ? <Check size={15} className="mr-1.5" /> : <Copy size={15} className="mr-1.5" />} {copied ? "Copied" : "Copy link"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href={enabled ? `/store/${storeLink}` : `/site-preview/${storeLink}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={15} className="mr-1.5" /> {enabled ? "View" : "Full preview"}
                      </a>
                    </Button>
                  </div>
                </div>

                {/* Free spots: the first few sellers get their website free. */}
                {founding && (
                  <p className="text-sm text-muted-foreground -mt-3">You're a founding seller, so your website is free.</p>
                )}
                {!founding && slots && !spotsFull && (
                  <p className="text-sm text-muted-foreground -mt-3">
                    {slots.limit - slots.taken} of {slots.limit} free website spots left. Switching your website on takes one, and it stays free for you.
                  </p>
                )}
                {spotsFull && (
                  <div className="rounded-2xl border bg-card p-4 sm:p-5 -mt-2 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold">The free website spots are all taken</p>
                      <p className="text-sm text-muted-foreground">
                        You can keep building and previewing your website, but it can't go live until paid plans open. Join the list and we'll tell you first.
                      </p>
                    </div>
                    <Button type="button" variant={waitlisted ? "outline" : "default"} disabled={waitlisted} onClick={joinWaitlist} className="shrink-0">
                      {waitlisted ? <><Check size={15} className="mr-1.5" /> You're on the list</> : "Tell me when plans are ready"}
                    </Button>
                  </div>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
                  {/* ── Controls ── */}
                  <div className="rounded-2xl border bg-card min-w-0">
                    <div className="flex border-b" role="tablist" aria-label="Website settings">
                      {([["look", "Look"], ["content", "Content"], ["layout", "Layout"], ["offers", "Offers"]] as const).map(([id, label]) => (
                        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                          className={`flex-1 h-12 text-sm font-semibold border-b-2 -mb-px transition-colors inline-flex items-center justify-center gap-1.5 ${tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                          {label}
                          {id === "offers" && offerNow && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Offer running" />}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 sm:p-6 space-y-8">
                      {tab === "look" && (
                        <>
                          <Block title="Style" hint="Each style has its own fonts, product cards and top of page. Switching resets the colours and layout choices below.">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {THEME_LIST.map((t) => {
                                const on = settings.theme === t.id;
                                const p = t.palettes[0];
                                return (
                                  <button key={t.id} type="button" aria-pressed={on}
                                    onClick={() => {
                                      loadThemeFonts(t);
                                      setSettings((s) => ({ ...s, theme: t.id as ThemeId, palette: 0, accent_color: null, hero_style: null, card_style: null, corners: null, text_color: null, heading_color: null }));
                                    }}
                                    className={`text-left rounded-xl overflow-hidden border-2 transition-colors ${on ? "border-primary" : "border-border hover:border-muted-foreground/50"}`}>
                                    <div className="h-24 px-3 py-2.5 flex flex-col justify-between relative" style={{ background: p.bg, color: p.ink }}>
                                      {t.premium && (
                                        <span className="absolute right-2 top-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ background: p.accent, color: p.dark ? p.bg : "#fff" }}>New</span>
                                      )}
                                      <span className="text-2xl leading-none" style={{ fontFamily: t.display, fontWeight: t.displayWeight, textTransform: t.displayStyle?.textTransform }}>
                                        {t.name}
                                      </span>
                                      <span className="flex gap-1">
                                        <span className="h-2.5 w-7 rounded-full" style={{ background: p.accent }} />
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.surface, boxShadow: `inset 0 0 0 1px ${p.line}` }} />
                                      </span>
                                    </div>
                                    <div className="px-3 py-2 bg-background">
                                      <p className="text-xs font-medium leading-snug">{t.suits}</p>
                                      {t.signature && <p className="text-xs text-muted-foreground leading-snug mt-1">{t.signature}</p>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </Block>

                          <Block title="Colours">
                            <div className="flex flex-wrap gap-3">
                              {theme.palettes.map((p, i) => {
                                const on = settings.palette === i;
                                return (
                                  <button key={p.name} type="button" aria-pressed={on} onClick={() => setSettings((s) => ({ ...s, palette: i, accent_color: null }))}
                                    className={`flex items-center gap-2.5 rounded-full border-2 pl-1.5 pr-4 h-11 text-sm font-medium transition-colors ${on ? "border-primary" : "border-border hover:border-muted-foreground/50"}`}>
                                    <span className="flex -space-x-1.5">
                                      {[p.bg, p.ink, p.accent].map((c) => <span key={c} className="h-7 w-7 rounded-full border-2 border-background" style={{ background: c }} />)}
                                    </span>
                                    {p.name}
                                  </button>
                                );
                              })}
                            </div>
                          </Block>

                          <Block title="Button colour" hint="Used for buttons, price tags and highlights.">
                            <div className="flex flex-wrap items-center gap-2">
                              {[pal.accent, "#e11d48", "#f4b400", "#16a34a", "#2563eb", "#7c3aed", "#ea580c", "#111827"].filter((c, i, a) => a.indexOf(c) === i).map((c) => {
                                const on = (settings.accent_color || pal.accent).toLowerCase() === c.toLowerCase();
                                return (
                                  <button key={c} type="button" onClick={() => set("accent_color", c === pal.accent ? null : c)} aria-label={`Use ${c}`} aria-pressed={on}
                                    className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-background transition-shadow ${on ? "ring-2 ring-foreground" : ""}`}
                                    style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} />
                                );
                              })}
                              <label className="relative h-9 w-9 rounded-full overflow-hidden cursor-pointer" title="Any colour">
                                <span className="sr-only">Pick any colour</span>
                                <span className="absolute inset-0" style={{ background: "conic-gradient(#ef4444,#f59e0b,#84cc16,#06b6d4,#6366f1,#ec4899,#ef4444)" }} />
                                <input type="color" value={settings.accent_color || pal.accent} onChange={(e) => set("accent_color", e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                              </label>
                            </div>
                          </Block>

                          <Block title="Text" hint="Make words bigger or smaller, bold or light, and pick their colour. Watch the preview as you change it.">
                            <div className="space-y-5">
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Heading size</p>
                                <Segmented label="Heading size" value={settings.heading_scale} options={SIZE_OPTIONS} onChange={(v) => set("heading_scale", v)} />
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Text size</p>
                                <Segmented label="Text size" value={settings.text_scale} options={SIZE_OPTIONS} onChange={(v) => set("text_scale", v)} />
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Heading weight</p>
                                <Segmented label="Heading weight" value={settings.heading_weight}
                                  options={[{ id: null, name: "Style's own" }, { id: "regular" as HeadingWeight, name: "Regular" }, { id: "bold" as HeadingWeight, name: "Bold" }]}
                                  onChange={(v) => set("heading_weight", v)} />
                                <p className="text-xs text-muted-foreground">A few fonts only come in one weight, so Bold may look the same on them.</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Text colour</p>
                                <ColorChoice label="Text colour" value={settings.text_color} onChange={(v) => set("text_color", v)} swatches={TEXT_SWATCHES} />
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Heading colour</p>
                                <ColorChoice label="Heading colour" value={settings.heading_color} onChange={(v) => set("heading_color", v)} swatches={[pal.accent, ...TEXT_SWATCHES]} />
                                <p className="text-xs text-muted-foreground">Headings over photos and coloured banners keep their own colour so they stay readable.</p>
                              </div>
                            </div>
                          </Block>

                          <Block title="Corners" hint="How rounded the photos, cards and boxes are.">
                            <div className="grid grid-cols-4 gap-2">
                              {([{ id: null, name: "Style's own" }, ...CORNERS] as { id: Corners | null; name: string }[]).map((c) => {
                                const on = settings.corners === c.id;
                                return (
                                  <button key={c.name} type="button" aria-pressed={on} onClick={() => set("corners", c.id)}
                                    className={`rounded-xl border-2 p-2.5 text-xs font-medium transition-colors ${on ? "border-primary" : "border-border hover:border-muted-foreground/50"}`}>
                                    <span className="mx-auto mb-1.5 block h-8 w-10 bg-muted-foreground/30"
                                      style={{ borderRadius: c.id === null ? theme.radius : (CORNERS.find((x) => x.id === c.id)?.radius ?? 0) / 2.2 }} />
                                    {c.name}
                                  </button>
                                );
                              })}
                            </div>
                          </Block>

                          <Block title="Product cards" hint="Mix any card with any style. Your style's own is marked.">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {CARD_STYLES.map((c) => {
                                const on = (settings.card_style ?? theme.card) === c.id;
                                return (
                                  <button key={c.id} type="button" aria-pressed={on} onClick={() => set("card_style", c.id === theme.card ? null : (c.id as CardStyle))}
                                    className={`text-left rounded-xl border-2 p-3 transition-colors ${on ? "border-primary" : "border-border hover:border-muted-foreground/50"}`}>
                                    <p className="text-sm font-semibold">{c.name}{c.id === theme.card && <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">style's own</span>}</p>
                                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{c.hint}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </Block>

                          <Block title="Products across" hint="How many products sit side by side on a computer. Phones always show two.">
                            <div className="inline-flex rounded-full border bg-background p-1" role="group" aria-label="Products across">
                              {([[null, "Automatic"], [3, "3, roomier"], [4, "4, denser"]] as const).map(([n, label]) => (
                                <button key={label} type="button" onClick={() => set("grid_cols", n)} aria-pressed={settings.grid_cols === n}
                                  className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${settings.grid_cols === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          </Block>
                        </>
                      )}

                      {tab === "content" && (
                        <>
                          <Block title="Main photo" hint="Shown at the top of your website. No photo? We use your newest product photos.">
                            <div className="flex items-center gap-3">
                              {settings.banner_url && (
                                <div className="relative">
                                  <img src={settings.banner_url} alt="" className="h-20 w-32 rounded-lg object-cover border" />
                                  <button type="button" onClick={() => set("banner_url", null)} aria-label="Remove photo"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-foreground text-background inline-flex items-center justify-center">
                                    <X size={12} />
                                  </button>
                                </div>
                              )}
                              <label className={`inline-flex items-center gap-2 h-10 px-4 rounded-md border text-sm font-medium cursor-pointer hover:bg-muted ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                                {settings.banner_url ? "Change photo" : "Add a photo"}
                                <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadBanner(e.target.files[0])} />
                              </label>
                            </div>
                          </Block>

                          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                            <div className="space-y-2">
                              <Label htmlFor="hero_title">Big headline (optional)</Label>
                              <Input id="hero_title" maxLength={80} placeholder="Empty shows your shop name" value={settings.hero_title ?? ""} onChange={(e) => set("hero_title", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="cta_text">Button words</Label>
                              <Input id="cta_text" maxLength={24} placeholder="Shop now" value={settings.cta_text ?? ""} onChange={(e) => set("cta_text", e.target.value)} />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="tagline">One line about your shop</Label>
                            <Input id="tagline" maxLength={120} placeholder="Quality sneakers, delivered across Nairobi" value={settings.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="about">About you</Label>
                            <Textarea id="about" rows={5} maxLength={1500} placeholder="Who you are, what you sell, where you deliver and how fast." value={settings.about ?? ""} onChange={(e) => set("about", e.target.value)} />
                            <p className="text-xs text-muted-foreground text-right">{(settings.about ?? "").length}/1500</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="announcement">Announcement bar (optional)</Label>
                            <Input id="announcement" maxLength={100} placeholder="Free delivery in Nairobi this week" value={settings.announcement ?? ""} onChange={(e) => set("announcement", e.target.value)} />
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="instagram">Instagram</Label>
                              <Input id="instagram" placeholder="@yourshop" value={settings.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="tiktok">TikTok</Label>
                              <Input id="tiktok" placeholder="@yourshop" value={settings.tiktok ?? ""} onChange={(e) => set("tiktok", e.target.value)} />
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground -mt-4">
                            Your shop name, logo and phone number come from <Link to="/vendor/settings" className="underline">Settings</Link>.
                          </p>

                          <Block title="Gallery" hint="Your own photos, like a lookbook of customers, your workshop or styled products. Up to 8.">
                            <div className="flex flex-wrap gap-3">
                              {settings.gallery.map((src, i) => (
                                <div key={src + i} className="relative">
                                  <img src={src} alt="" className="h-20 w-20 rounded-lg object-cover border" />
                                  <button type="button" onClick={() => set("gallery", settings.gallery.filter((_, j) => j !== i))} aria-label="Remove photo"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-foreground text-background inline-flex items-center justify-center"><X size={12} /></button>
                                </div>
                              ))}
                              {settings.gallery.length < 8 && (
                                <label className={`h-20 w-20 rounded-lg border-2 border-dashed inline-flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground cursor-pointer hover:bg-muted ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                                  Add
                                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { if (e.target.files?.length) addGalleryPhotos(e.target.files); e.target.value = ""; }} />
                                </label>
                              )}
                            </div>
                          </Block>

                          <Block title="Questions buyers ask" hint="Shown as a tidy open-and-close list. It saves you answering the same questions in chat.">
                            <div className="space-y-3">
                              {settings.faqs.map((f, i) => (
                                <div key={i} className="rounded-xl border p-3 space-y-2">
                                  <div className="flex gap-2">
                                    <Input aria-label={`Question ${i + 1}`} maxLength={120} placeholder="Question" value={f.q} onChange={(e) => setFaq(i, { q: e.target.value })} />
                                    <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Remove question" onClick={() => set("faqs", settings.faqs.filter((_, j) => j !== i))}><Trash2 size={16} /></Button>
                                  </div>
                                  <Textarea aria-label={`Answer ${i + 1}`} rows={2} maxLength={500} placeholder="Answer" value={f.a} onChange={(e) => setFaq(i, { a: e.target.value })} />
                                </div>
                              ))}
                              <div className="flex flex-wrap gap-2">
                                {settings.faqs.length < 8 && (
                                  <Button type="button" variant="outline" size="sm" onClick={() => set("faqs", [...settings.faqs, { q: "", a: "" }])}><Plus size={15} className="mr-1.5" /> Add a question</Button>
                                )}
                                {settings.faqs.length === 0 && (
                                  <Button type="button" variant="outline" size="sm" onClick={() => set("faqs", STARTER_FAQS)}>Start with delivery, payment and returns</Button>
                                )}
                              </div>
                            </div>
                          </Block>
                        </>
                      )}

                      {tab === "layout" && (
                        <>
                          <Block title="Top of the page">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {HERO_STYLES.map((h) => {
                                const on = (settings.hero_style ?? theme.hero) === h.id;
                                return (
                                  <button key={h.id} type="button" aria-pressed={on} onClick={() => set("hero_style", h.id === theme.hero ? null : h.id)}
                                    className={`text-left rounded-xl border-2 p-3 transition-colors ${on ? "border-primary" : "border-border hover:border-muted-foreground/50"}`}>
                                    <div className="h-10 mb-2.5"><HeroIcon id={h.id} /></div>
                                    <p className="text-sm font-semibold">{h.name}</p>
                                    <p className="text-xs text-muted-foreground leading-snug">{h.hint}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </Block>

                          <Block title="Sections" hint="Move sections up or down, or hide the ones you don't want.">
                            <ul className="rounded-xl border divide-y">
                              {settings.sections.map((s, i) => {
                                const info = SECTION_LABELS[s.id];
                                return (
                                  <li key={s.id} className={`flex items-center gap-2 p-2.5 pl-4 ${s.visible ? "" : "bg-muted/40"}`}>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-medium ${s.visible ? "" : "text-muted-foreground line-through"}`}>{info.name}</p>
                                      <p className="text-xs text-muted-foreground truncate">{info.hint}</p>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={i === 0} onClick={() => moveSection(i, -1)} aria-label={`Move ${info.name} up`}>
                                      <ArrowUp size={16} />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={i === settings.sections.length - 1} onClick={() => moveSection(i, 1)} aria-label={`Move ${info.name} down`}>
                                      <ArrowDown size={16} />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9"
                                      onClick={() => set("sections", settings.sections.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x)))}
                                      aria-label={s.visible ? `Hide ${info.name}` : `Show ${info.name}`}>
                                      {s.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </Button>
                                  </li>
                                );
                              })}
                            </ul>
                            <p className="text-xs text-muted-foreground">Sections with nothing to show yet, like reviews before your first one, stay hidden on their own.</p>
                          </Block>

                          <Block title="WhatsApp button" hint="A round chat button on every page, using the phone number in your Settings.">
                            <div className="flex items-center gap-3">
                              <Switch checked={settings.whatsapp_button} onCheckedChange={(v) => set("whatsapp_button", v)} aria-label="Show the WhatsApp chat button" />
                              <span className="text-sm">{settings.whatsapp_button ? "Shown to buyers" : "Hidden"}</span>
                            </div>
                          </Block>
                        </>
                      )}

                      {tab === "offers" && (
                        <>
                          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex gap-3">
                            <Globe className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="text-sm space-y-1.5">
                              <p className="font-semibold">Your offer also shows on Solely</p>
                              <p className="text-muted-foreground leading-relaxed">
                                While your website is on, your offer appears as a badge on every one of your products across the Solely marketplace, on your card in the shop directory, and in the "Offers right now" row at the top of Shop. Everyone who taps it lands on your website, so the people Solely brings in become your buyers.
                              </p>
                            </div>
                          </div>

                          {!enabled && (
                            <p className="text-sm rounded-xl bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 px-4 py-3">
                              Your website is off, so this offer won't show anywhere yet. Switch it on at the top of this page.
                            </p>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="offer_title">Offer headline</Label>
                            <Input id="offer_title" maxLength={40} placeholder="Free delivery this weekend" value={settings.offer_title ?? ""}
                              onChange={(e) => setSettings((s) => ({ ...s, offer_title: e.target.value, offer_ends_at: s.offer_ends_at ?? endOfDayIn(3) }))} />
                            <p className="text-xs text-muted-foreground">Short and specific works best: "20% off sneakers", "Buy 2 get free delivery".</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="offer_text">Details (optional)</Label>
                            <Textarea id="offer_text" rows={2} maxLength={140} placeholder="Order any 2 items and delivery within Nairobi is on us." value={settings.offer_text ?? ""} onChange={(e) => set("offer_text", e.target.value)} />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="offer_ends_at">Ends</Label>
                            <div className="flex flex-wrap gap-2 items-center">
                              <Input id="offer_ends_at" type="datetime-local" className="w-auto" value={toLocalInput(settings.offer_ends_at)}
                                onChange={(e) => set("offer_ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />
                              {([[0, "Tonight"], [3, "3 days"], [7, "1 week"]] as const).map(([d, label]) => (
                                <Button key={d} type="button" variant="outline" size="sm" onClick={() => set("offer_ends_at", endOfDayIn(d))}>{label}</Button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Offers run for up to {MAX_OFFER_DAYS} days. When the time is up, they disappear from your website and from Solely by themselves.</p>
                          </div>

                          <div className="rounded-xl border p-4 text-sm leading-relaxed text-muted-foreground">
                            <p className="font-semibold text-foreground mb-1">This is a label, not a price change</p>
                            Buyers see the offer and pay the price on your products, so change your product prices if the offer is a discount, or agree things like free delivery with the buyer in chat. Honouring what you advertise keeps your rating high.
                          </div>

                          {offerNow ? (
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 px-4 py-3">
                              <p className="text-sm flex items-center gap-2"><Sparkles size={16} className="text-emerald-600" aria-hidden="true" /> Running now: <strong>{offerNow.title}</strong></p>
                              <Button type="button" variant="outline" size="sm"
                                onClick={() => setSettings((s) => ({ ...s, offer_title: null, offer_text: null, offer_ends_at: null }))}>End offer</Button>
                            </div>
                          ) : settings.offer_title ? (
                            <p className="text-sm text-muted-foreground">Save to start this offer.</p>
                          ) : null}
                        </>
                      )}
                    </div>

                    <div className="sticky bottom-0 border-t bg-card/95 p-4 flex items-center justify-between gap-3 rounded-b-2xl">
                      <p className="text-sm text-muted-foreground">{dirty ? "You have unsaved changes" : "All changes saved"}</p>
                      <Button type="button" onClick={save} disabled={saving || !dirty}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {enabled ? "Publish changes" : "Save"}
                      </Button>
                    </div>
                  </div>

                  {/* ── Preview ── */}
                  <div className="order-first lg:order-none lg:sticky lg:top-20 min-w-0">
                    <Preview storeLink={storeLink} settings={settings} />
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default VendorWebsite;
