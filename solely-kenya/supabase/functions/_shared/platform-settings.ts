/**
 * Platform Settings for Supabase Edge Functions
 *
 * Reads admin-tunable platform parameters (commission rate, kill switches,
 * time windows, payout fee schedule) from the `platform_settings` table
 * instead of a hardcoded literal. Falls back to the given default if the
 * row is missing or the table can't be reached, so a settings outage
 * degrades to today's known-good behavior rather than breaking checkout.
 */

export async function getPlatformSetting<T>(
  supabase: any,
  key: string,
  fallback: T
): Promise<T> {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error || !data) return fallback;
    return data.value as T;
  } catch {
    return fallback;
  }
}

export async function getCommissionRatePercent(supabase: any): Promise<number> {
  return getPlatformSetting<number>(supabase, "commission_rate_percent", 6);
}

export interface PayoutFeeTier {
  max_ksh?: number;
  fee_ksh: number;
}

const DEFAULT_PAYOUT_FEE_SCHEDULE: PayoutFeeTier[] = [
  { max_ksh: 100, fee_ksh: 10 },
  { max_ksh: 1000, fee_ksh: 20 },
  { fee_ksh: 100 },
];

export async function getPayoutFeeSchedule(supabase: any): Promise<PayoutFeeTier[]> {
  return getPlatformSetting<PayoutFeeTier[]>(
    supabase,
    "payout_fee_schedule",
    DEFAULT_PAYOUT_FEE_SCHEDULE
  );
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
