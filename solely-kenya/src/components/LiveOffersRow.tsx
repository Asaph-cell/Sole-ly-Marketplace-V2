import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { endsIn, useLiveOffers } from "@/lib/liveOffers";

/**
 * "Offers right now": shops running an offer on their own Solely website.
 * Every card goes to that shop's website, so marketplace visitors become the
 * seller's visitors. Renders nothing when no shop has an offer.
 */
export const LiveOffersRow = () => {
  const offers = Array.from(useLiveOffers().values());
  if (!offers.length) return null;

  return (
    <section className="mb-6" aria-label="Offers right now">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-amber-500" aria-hidden="true" />
        <h2 className="text-base sm:text-lg font-bold">Offers right now</h2>
      </div>
      <ul className="flex gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 snap-x [scrollbar-width:none]">
        {offers.map((o) => (
          <li key={o.vendorId} className="shrink-0 snap-start w-[78%] sm:w-72">
            <Link
              to={`/store/${o.storeLink}`}
              className="group flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                {o.logo ? (
                  <img src={o.logo} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    {o.shopName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{o.shopName}</p>
                  <p className="text-xs text-muted-foreground">{endsIn(o.endsAt)}</p>
                </div>
              </div>
              <div>
                <p className="font-bold leading-snug line-clamp-1">{o.title}</p>
                {o.text && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{o.text}</p>}
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary">
                See the offer <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
