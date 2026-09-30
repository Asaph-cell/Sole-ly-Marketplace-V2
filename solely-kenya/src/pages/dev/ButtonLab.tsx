import { useRef, type ReactNode, type PointerEvent } from "react";
import {
  ArrowRight, ArrowUpRight, Bell, Bookmark, Camera, Check, ChevronRight, Clock, Copy, CreditCard,
  Download, ExternalLink, Eye, Filter, Gift, Heart, Link2, Lock, LogOut, Mail, MapPin, MessageCircle,
  Package, Pencil, Phone, Plus, Printer, QrCode, RefreshCw, Rocket, Save, Search, Send, Settings,
  Share2, ShieldCheck, ShoppingBag, Sparkles, Star, Tag, ThumbsUp, Trash2, Truck, Upload, Wallet, X, Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./button-lab.css";

/**
 * Dev-only playground for button motion (routed only when import.meta.env.DEV).
 * Pick a gold style (A-H) and a press feel; the icon motions ship everywhere.
 */

const Section = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <section className="space-y-4">
    <div>
      <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
    </div>
    {children}
  </section>
);

const Option = ({ letter, name, note, children }: { letter: string; name: string; note: string; children: ReactNode }) => (
  <div className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
    <div>
      <p className="text-sm font-semibold">
        <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-xs text-primary-strong">{letter}</span>
        {name}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </div>
);

// B: cursor position drives the highlight.
const Spotlight = () => {
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <button className="lab-gold btn-fx fx-spotlight" onPointerMove={onMove}>
      <Plus size={16} strokeWidth={2} /><span>List an item</span>
    </button>
  );
};

// E: the button leans up to 5px toward the cursor, then springs home.
const Magnetic = () => {
  const ref = useRef<HTMLButtonElement>(null);
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width - 0.5) * 10;
    const dy = ((e.clientY - r.top) / r.height - 0.5) * 8;
    e.currentTarget.style.setProperty("--tx", `${dx.toFixed(1)}px`);
    e.currentTarget.style.setProperty("--ty", `${dy.toFixed(1)}px`);
  };
  const onLeave = () => {
    ref.current?.style.setProperty("--tx", "0px");
    ref.current?.style.setProperty("--ty", "0px");
  };
  return (
    <button ref={ref} className="lab-gold btn-fx fx-magnetic" onPointerMove={onMove} onPointerLeave={onLeave}>
      <span className="inline-flex items-center gap-2"><Send size={16} />Send payment link</span>
    </button>
  );
};

const StripeArrow = () => (
  <svg className="arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="1" y1="7" x2="10" y2="7" />
    <polyline points="6 3 10 7 6 11" />
  </svg>
);

const ICONS: [LucideIcon, string, string][] = [
  [Plus, "Add", "turns a quarter"],
  [X, "Close", "turns a quarter"],
  [ArrowRight, "Continue", "nudges forward"],
  [ArrowUpRight, "Open", "drifts out"],
  [ExternalLink, "Visit store", "drifts out"],
  [Share2, "Share", "drifts out"],
  [Link2, "Pay link", "drifts out"],
  [Download, "Download", "dips"],
  [Upload, "Upload", "rises"],
  [Copy, "Copy", "sheets slide apart"],
  [Trash2, "Delete", "lid tips open"],
  [Lock, "Secure", "shackle lifts"],
  [Mail, "Email", "flap lifts"],
  [Printer, "Print", "page comes out"],
  [Gift, "Gift", "lid pops"],
  [Clock, "Schedule", "hands sweep"],
  [LogOut, "Log out", "arrow leaves"],
  [Check, "Confirm", "tick draws in"],
  [ShieldCheck, "Verified", "tick draws in"],
  [Heart, "Save", "fills and beats"],
  [Star, "Rate", "spins and fills"],
  [Bookmark, "Keep", "fills"],
  [Bell, "Alerts", "rings"],
  [Phone, "Call", "buzzes"],
  [Eye, "Preview", "blinks"],
  [MapPin, "Location", "hops"],
  [Package, "Orders", "hops"],
  [Truck, "Ship", "drives off"],
  [Send, "Send", "flies off, returns"],
  [Rocket, "Boost", "launches"],
  [Sparkles, "New", "twinkles"],
  [Zap, "Instant", "flickers"],
  [Camera, "Photo", "shutter"],
  [RefreshCw, "Refresh", "half turn"],
  [Settings, "Settings", "gear turns"],
  [Pencil, "Edit", "pen tilts"],
  [Search, "Search", "leans in"],
  [ShoppingBag, "Add to bag", "hops up"],
  [Tag, "Price", "swings"],
  [CreditCard, "Pay", "slides"],
  [Wallet, "Wallet", "tilts"],
  [ThumbsUp, "Like", "thumbs up"],
  [Filter, "Filter", "squeezes"],
  [QrCode, "QR code", "grows"],
  [Save, "Save changes", "swells"],
  [MessageCircle, "Message", "tilts"],
];

const ButtonLab = () => (
  <div className="min-h-screen bg-background px-5 py-10 sm:px-8">
    <div className="mx-auto max-w-5xl space-y-12">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Button lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hover and press everything. Try both themes.</p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="1 · Gold button style" note="Live on the site: E (magnetic) on gold and ink buttons.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Option letter="A" name="Lift + sweep" note="Current. Rises 1px, warm shadow grows, one light sweep crosses.">
            <Button className="rounded-full px-5"><Plus size={16} strokeWidth={2} /> List an item</Button>
          </Option>
          <Option letter="B" name="Spotlight" note="A soft glow follows your cursor inside the button.">
            <Spotlight />
          </Option>
          <Option letter="C" name="Keycap" note="Has a real bottom edge. Pressing pushes it all the way down.">
            <button className="lab-gold btn-fx fx-key"><Download size={16} /><span>Withdraw</span></button>
          </Option>
          <Option letter="D" name="Fill wipe" note="Gold outline at rest; gold floods in from the left on hover.">
            <button className="lab-gold btn-fx fx-wipe"><Upload size={16} /><span>Publish</span></button>
          </Option>
          <Option letter="E" name="Magnetic" note="Leans toward your cursor, springs back when you leave.">
            <Magnetic />
          </Option>
          <Option letter="F" name="Arrow grows" note="A line grows in front of the chevron to make an arrow.">
            <button className="lab-gold btn-fx fx-stripe"><span>Start selling</span><StripeArrow /></button>
          </Option>
          <Option letter="G" name="Border run" note="A bright arc runs around the edge while hovered.">
            <button className="lab-gold btn-fx fx-border"><ShieldCheck size={16} /><span>Pay securely</span></button>
          </Option>
          <Option letter="H" name="Quiet" note="Just deepens and lets the icon move. The Linear approach.">
            <button className="lab-gold btn-fx fx-quiet"><Plus size={16} strokeWidth={2} /><span>List an item</span></button>
          </Option>
        </div>
      </Section>

      <Section title="2 · Press feel" note="Live on the site: 4 (dip) on every button.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Option letter="1" name="Spring" note="Shrinks fast, springs back with a tiny overshoot. Current.">
            <button className="lab-gold press-spring"><span>Confirm order</span></button>
          </Option>
          <Option letter="2" name="Squish" note="Squashes wide and short, then wobbles back. Playful.">
            <button className="lab-gold press-squish"><span>Confirm order</span></button>
          </Option>
          <Option letter="3" name="Sink" note="Doesn't move; the surface darkens and looks pressed in.">
            <button className="lab-gold press-sink"><span>Confirm order</span></button>
          </Option>
          <Option letter="4" name="Dip" note="Drops 2px while held, springs up on release.">
            <button className="lab-gold press-dip"><span>Confirm order</span></button>
          </Option>
        </div>
      </Section>

      <Section title="3 · Icon motions" note="These already ship on every button. Hover a tile.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ICONS.map(([Icon, label, motion]) => (
            <Button key={label} variant="outline" className="h-auto justify-start gap-3 rounded-xl px-3 py-2.5">
              <Icon size={18} strokeWidth={1.75} />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm">{label}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{motion}</span>
              </span>
            </Button>
          ))}
        </div>
      </Section>

      <Section title="4 · Every variant as it ships">
        <div className="flex flex-wrap items-center gap-3">
          <Button><Plus size={16} strokeWidth={2} /> Gold</Button>
          <Button variant="secondary"><Save size={16} /> Ink</Button>
          <Button variant="outline"><Copy size={15} /> Outline</Button>
          <Button variant="ghost">Ghost <ChevronRight size={16} /></Button>
          <Button variant="accent"><Check size={16} /> Soft gold</Button>
          <Button variant="destructive"><Trash2 size={16} /> Delete</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>
    </div>
  </div>
);

export default ButtonLab;
