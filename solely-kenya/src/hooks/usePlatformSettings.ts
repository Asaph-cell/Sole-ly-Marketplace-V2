import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PayoutFeeTier {
  max_ksh?: number;
  fee_ksh: number;
}

export interface PlatformSettingsValues {
  commissionRatePercent: number;
  maintenanceMode: boolean;
  checkoutDisabled: boolean;
  maintenanceBannerEnabled: boolean;
  maintenanceBannerMessage: string;
  vendorConfirmHours: number;
  autoDisputeDays: number;
  pinReleaseHours: number;
  minimumAutoPayoutKsh: number;
  payoutFeeSchedule: PayoutFeeTier[];
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsValues = {
  commissionRatePercent: 6,
  maintenanceMode: false,
  checkoutDisabled: false,
  maintenanceBannerEnabled: false,
  maintenanceBannerMessage: "We're making some updates right now. Everything still works, but you might notice a few changes.",
  vendorConfirmHours: 48,
  autoDisputeDays: 5,
  pinReleaseHours: 6,
  minimumAutoPayoutKsh: 10000,
  payoutFeeSchedule: [
    { max_ksh: 100, fee_ksh: 10 },
    { max_ksh: 1000, fee_ksh: 20 },
    { fee_ksh: 100 },
  ],
};

const KEY_MAP: Record<keyof PlatformSettingsValues, string> = {
  commissionRatePercent: "commission_rate_percent",
  maintenanceMode: "maintenance_mode",
  checkoutDisabled: "checkout_disabled",
  maintenanceBannerEnabled: "maintenance_banner_enabled",
  maintenanceBannerMessage: "maintenance_banner_message",
  vendorConfirmHours: "vendor_confirm_hours",
  autoDisputeDays: "auto_dispute_days",
  pinReleaseHours: "pin_release_hours",
  minimumAutoPayoutKsh: "minimum_auto_payout_ksh",
  payoutFeeSchedule: "payout_fee_schedule",
};

async function fetchPlatformSettings(): Promise<PlatformSettingsValues> {
  const { data, error } = await supabase.from("platform_settings").select("key, value");
  if (error || !data) return DEFAULT_PLATFORM_SETTINGS;

  const byKey = new Map(data.map((row) => [row.key, row.value]));
  const result = { ...DEFAULT_PLATFORM_SETTINGS };
  (Object.keys(KEY_MAP) as (keyof PlatformSettingsValues)[]).forEach((field) => {
    const raw = byKey.get(KEY_MAP[field]);
    if (raw !== undefined && raw !== null) {
      (result as any)[field] = raw;
    }
  });
  return result;
}

/**
 * Admin-tunable platform config (commission rate, kill switches, time
 * windows, payout fees) - see supabase/migrations/20260904000100_platform_settings.sql.
 * Seeded with today's known-good defaults as `initialData` so pages render
 * immediately instead of blocking on a fetch; a change made in the admin
 * Settings page lands on the next query refetch (default 5 min staleTime,
 * or immediately after this hook's queryClient cache is invalidated).
 */
export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: fetchPlatformSettings,
    initialData: DEFAULT_PLATFORM_SETTINGS,
    // Without this, React Query treats initialData as fresh-as-of-now and,
    // combined with staleTime below, never actually fetches - every page
    // would silently run on hardcoded defaults forever. Backdating it to
    // the epoch marks it stale immediately, so a real fetch always kicks
    // off on mount; staleTime then governs re-fetching after that.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
}

/** Evaluates a payout-fee schedule (tiers in ascending order, last entry has no max_ksh) for an amount. */
export function resolvePayoutFee(schedule: PayoutFeeTier[], amountKsh: number): number {
  for (const tier of schedule) {
    if (tier.max_ksh === undefined || amountKsh <= tier.max_ksh) {
      return tier.fee_ksh;
    }
  }
  return schedule[schedule.length - 1]?.fee_ksh ?? 0;
}
