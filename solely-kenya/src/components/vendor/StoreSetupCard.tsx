import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Clock } from "lucide-react";
import { getStoreSetup, SetupProfile } from "@/lib/storeSetup";

// Dashboard nudge showing how far the store setup is. Hidden once the store
// is fully set up so it never becomes permanent clutter.
export const ProgressRing = ({ percent, size = 56 }: { percent: number; size?: number }) => {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums">{percent}%</span>
    </div>
  );
};

export const StoreSetupCard = ({ profile, className = "" }: { profile: SetupProfile | null; className?: string }) => {
  if (!profile) return null;
  const setup = getStoreSetup(profile);
  if (setup.complete) return null;

  const pending = setup.verification === "pending";
  const rejected = setup.verification === "rejected";

  return (
    <Link
      to="/vendor/setup"
      className={`group flex flex-nowrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5 transition-[box-shadow,border-color] duration-200 ease-out-strong hover:border-primary/40 hover:shadow-hover ${className}`}
    >
      <ProgressRing percent={setup.percent} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">Your store is {setup.percent}% set up</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {rejected ? (
            "Your verification needs another look. Tap to see why."
          ) : setup.nextStep ? (
            <>Next: {setup.nextStep.toLowerCase()}. {!setup.level2Done ? "Finish your profile to appear in the Stores directory." : "Verified sellers get a badge buyers trust."}</>
          ) : pending ? (
            <span className="inline-flex items-center gap-1.5"><Clock size={14} /> Verification in review. We'll let you know once it's checked.</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><BadgeCheck size={14} /> Almost there</span>
          )}
        </p>
      </div>
      <ArrowRight size={18} className="shrink-0 text-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
};
