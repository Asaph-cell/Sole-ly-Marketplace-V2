/**
 * Full-screen success moment for the few events that deserve one: payment
 * confirmed, delivery code accepted and funds released, order completed.
 * These happen a handful of times per order, so they get the delight budget
 * that everyday UI doesn't.
 *
 *   celebrate({ title: "Payment confirmed", subtitle: "..." })
 *
 * Mounted once in App; call celebrate() from anywhere.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface CelebrationOptions {
  title: string;
  subtitle?: string;
  /** Big figure under the title, e.g. "KES 4,500". */
  amount?: string;
  cta?: string;
}

type Listener = (opts: CelebrationOptions) => void;
const listeners = new Set<Listener>();

export function celebrate(opts: CelebrationOptions) {
  listeners.forEach((l) => l(opts));
  // Chrome only allows vibration after the user has interacted with the page.
  const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
  if (typeof navigator !== "undefined" && "vibrate" in navigator && activated) {
    try {
      navigator.vibrate?.([12, 60, 24]);
    } catch {
      // vibration is a nicety; ignore unsupported devices
    }
  }
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const CONFETTI_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#3b82f6", "#ec4899"];

function Confetti() {
  // Fixed seed per mount: 28 pieces bursting outward from the badge.
  const [pieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 110 + Math.random() * 90;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 40,
        r: Math.random() * 540 - 270,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + Math.random() * 4,
        round: i % 3 === 0,
      };
    }),
  );

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ width: p.w, height: p.round ? p.w : p.w * 0.45, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ transform: "translate(0px, 0px) rotate(0deg)", opacity: 1 }}
          animate={{ transform: `translate(${p.x}px, ${p.y + 160}px) rotate(${p.r}deg)`, opacity: 0 }}
          transition={{ duration: 1.3, ease: EASE_OUT, delay: 0.12 }}
        />
      ))}
    </div>
  );
}

export function CelebrationHost() {
  const [current, setCurrent] = useState<CelebrationOptions | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const l: Listener = (opts) => setCurrent(opts);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrent(null), 6000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCurrent(null);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key="celebration"
          role="alertdialog"
          aria-live="assertive"
          aria-label={current.title}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.2 }}
          onClick={() => setCurrent(null)}
        >
          <motion.div
            className="relative w-full max-w-sm rounded-3xl bg-card text-card-foreground p-8 text-center shadow-2xl"
            initial={{ opacity: 0, transform: "scale(0.94) translateY(8px)" }}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={{ opacity: 0, transform: "scale(0.97)" }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {!reduceMotion && <Confetti />}

            <motion.div
              className="relative mx-auto mb-5 h-20 w-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
              initial={{ transform: "scale(0.6)" }}
              animate={{ transform: "scale(1)" }}
              transition={{ type: "spring", duration: 0.55, bounce: 0.45, delay: 0.05 }}
            >
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.25 }}
                />
              </svg>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, transform: "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-1.5">{current.title}</h2>
              {current.amount && <p className="text-3xl font-extrabold text-emerald-600 my-2 tabular-nums">{current.amount}</p>}
              {current.subtitle && <p className="text-muted-foreground text-sm leading-relaxed">{current.subtitle}</p>}
              <Button className="mt-6 w-full" size="lg" onClick={() => setCurrent(null)} autoFocus>
                {current.cta ?? "Done"}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
