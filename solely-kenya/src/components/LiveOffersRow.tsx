import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { endsIn, useLiveOffers, type MarketOffer } from "@/lib/liveOffers";

const ROTATE_MS = 4500;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** One offer tile: a photo from the shop, the offer on it, the shop underneath. */
const OfferTile = ({ o, wide }: { o: MarketOffer; wide?: boolean }) => (
  <Link
    to={`/store/${o.storeLink}`}
    className="group block h-full overflow-hidden rounded-2xl border bg-card transition-shadow duration-200 hover:shadow-lg"
  >
    <div className="relative h-28 sm:h-36 w-full overflow-hidden bg-muted">
      {o.photo ? (
        <img src={o.photo} alt="" className={`h-full w-full bg-white ${wide ? "object-contain" : "object-cover"}`} loading="lazy" />
      ) : (
        <span className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-3xl" aria-hidden="true">
          {o.shopName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8">
        <p className="flex items-start gap-1 text-sm font-extrabold leading-tight text-[#ffd166] line-clamp-2">
          <Sparkles size={13} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{o.title}</span>
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 px-3 py-2.5 min-w-0">
      {o.logo ? (
        <img src={o.logo} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
      ) : (
        <span className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold inline-flex items-center justify-center shrink-0" aria-hidden="true">
          {o.shopName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{o.shopName}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{endsIn(o.endsAt)}</p>
      </div>
    </div>
  </Link>
);

/**
 * A slot shows one offer and, if it has several, swaps to the next every few
 * seconds. Holding a finger or the pointer on it pauses the swap.
 */
const OfferSlot = ({ offers, startDelay, wide }: { offers: MarketOffer[]; startDelay: number; wide?: boolean }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const rotates = offers.length > 1 && !prefersReducedMotion();

  useEffect(() => {
    if (!rotates || paused) return;
    let interval: ReturnType<typeof setInterval>;
    const first = setTimeout(() => {
      setIndex((i) => (i + 1) % offers.length);
      interval = setInterval(() => setIndex((i) => (i + 1) % offers.length), ROTATE_MS);
    }, startDelay);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [rotates, paused, offers.length, startDelay]);

  const current = offers[index % offers.length];

  return (
    <div
      className="relative"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.vendorId}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
        >
          <OfferTile o={current} wide={wide} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/**
 * "Offers right now": shops running an offer on their own Solely website.
 * Two tiles side by side that swap through every live offer a few seconds
 * apart, so ten offers take the same room as two and nobody sees a count.
 * Every tile goes to that shop's website. Renders nothing with no offers.
 */
export const LiveOffersRow = () => {
  // Soonest-ending first, so urgent offers get seen first.
  const offers = Array.from(useLiveOffers().values()).sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
  if (!offers.length) return null;

  const left = offers.filter((_, i) => i % 2 === 0);
  const right = offers.filter((_, i) => i % 2 === 1);

  return (
    <section className="mb-6" aria-label="Offers right now">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-amber-500" aria-hidden="true" />
        <h2 className="text-base sm:text-lg font-bold">Offers right now</h2>
      </div>
      <div className={`grid gap-3 ${right.length ? "grid-cols-2" : "grid-cols-1"}`}>
        <OfferSlot offers={left} startDelay={ROTATE_MS} wide={!right.length} />
        {right.length > 0 && <OfferSlot offers={right} startDelay={ROTATE_MS + ROTATE_MS / 2} />}
      </div>
    </section>
  );
};
