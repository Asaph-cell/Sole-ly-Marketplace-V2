import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

type Tone = "urgent" | "attention" | "quiet";

const DOT: Record<Tone, string> = {
  urgent: "bg-destructive",
  attention: "bg-primary",
  quiet: "bg-muted-foreground/50",
};

/**
 * One-line notice under the vendor navbar. Deliberately calm: a coloured dot
 * carries the urgency, the text says what and how long, and the whole strip
 * is the link. Pages that already show the same thing hide the strip.
 */
export const AlertStrip = ({ tone, text, detail, to, cta }: {
  tone: Tone;
  text: string;
  detail?: string;
  to: string;
  cta: string;
}) => (
  <Link
    to={to}
    className="group flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-muted/50 sm:px-6"
  >
    <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} aria-hidden />
    <p className="min-w-0 flex-1 truncate">
      <span className="font-semibold">{text}</span>
      {detail && <span className="text-muted-foreground"> · {detail}</span>}
    </p>
    <span className="hidden shrink-0 text-xs font-semibold sm:inline">{cta}</span>
    <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
  </Link>
);
