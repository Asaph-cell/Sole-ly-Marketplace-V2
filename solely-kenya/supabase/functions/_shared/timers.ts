/**
 * Order clocks (order_timers).
 *
 * A timer has a due_at (when its outcome fires) and an optional schedule of
 * reminder moments before that. `stage` indexes into the schedule; the
 * engine always acts at next_at = schedule[stage] ?? due_at.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPlatformSetting } from "./platform-settings.ts";
import { DEFAULT_PAUSE, type NightPause, addActiveHours, addHours } from "./business-hours.ts";

export type TimerKind =
    | "ship" | "deliver" | "release" | "checklist_hold" | "vendor_response"
    | "negotiation" | "fix" | "return_confirm" | "buyer_unavailable";

export interface TimerRow {
    id: string;
    order_id: string;
    kind: TimerKind;
    status: string;
    started_at: string;
    due_at: string;
    next_at: string;
    stage: number;
    extensions: number;
    meta: Record<string, unknown> & { schedule?: string[] };
}

export async function getNightPause(supabase: SupabaseClient): Promise<NightPause> {
    const [start, end] = await Promise.all([
        getPlatformSetting<string>(supabase, "night_pause_start", DEFAULT_PAUSE.start),
        getPlatformSetting<string>(supabase, "night_pause_end", DEFAULT_PAUSE.end),
    ]);
    return { start, end };
}

export const setting = <T>(supabase: SupabaseClient, key: string, fallback: T) =>
    getPlatformSetting<T>(supabase, key, fallback);

/** Starts (or restarts) a clock, replacing any live one of the same kind. */
export async function startTimer(
    supabase: SupabaseClient,
    orderId: string,
    kind: TimerKind,
    due: Date,
    opts: { schedule?: Date[]; meta?: Record<string, unknown>; extensions?: number } = {},
): Promise<void> {
    const now = new Date();
    await endTimers(supabase, orderId, [kind], "cancelled");

    const schedule = (opts.schedule ?? [])
        .filter((d) => d.getTime() > now.getTime() && d.getTime() < due.getTime())
        .sort((a, b) => a.getTime() - b.getTime())
        .map((d) => d.toISOString());

    const { error } = await supabase.from("order_timers").insert({
        order_id: orderId,
        kind,
        due_at: due.toISOString(),
        next_at: schedule[0] ?? due.toISOString(),
        stage: 0,
        extensions: opts.extensions ?? 0,
        meta: { ...(opts.meta ?? {}), schedule },
    });
    if (error) throw new Error(`Couldn't start ${kind} timer: ${error.message}`);
}

export async function endTimers(
    supabase: SupabaseClient,
    orderId: string,
    kinds: TimerKind[] | "all",
    status: "done" | "cancelled" | "escalated" = "done",
): Promise<void> {
    let q = supabase
        .from("order_timers")
        .update({ status, resolved_at: new Date().toISOString() })
        .eq("order_id", orderId)
        .eq("status", "active");
    if (kinds !== "all") q = q.in("kind", kinds);
    const { error } = await q;
    if (error) console.error(`[Timers] Couldn't end timers on ${orderId}:`, error);
}

export async function getActiveTimer(supabase: SupabaseClient, orderId: string, kind: TimerKind): Promise<TimerRow | null> {
    const { data } = await supabase
        .from("order_timers")
        .select("*")
        .eq("order_id", orderId)
        .eq("kind", kind)
        .eq("status", "active")
        .maybeSingle();
    return (data as TimerRow) ?? null;
}

// ── Clock recipes ──────────────────────────────────────────────────────────
// Each returns the due date and reminder moments for one kind, so starting
// a clock and extending one always agree.

/** A1: accepted → shipped. Daytime hours only. */
export async function shipClock(supabase: SupabaseClient, from: Date) {
    const pause = await getNightPause(supabase);
    const [first, expected, deadline] = await Promise.all([
        setting(supabase, "ship_first_reminder_hours", 1),
        setting(supabase, "ship_expected_hours", 3),
        setting(supabase, "ship_deadline_hours", 8),
    ]);
    return {
        due: addActiveHours(from, deadline, pause),
        schedule: [addActiveHours(from, first, pause), addActiveHours(from, expected, pause)],
    };
}

/** A1 extension: push the deadline back, with one reminder an hour before. */
export async function extendShipClock(supabase: SupabaseClient, currentDue: Date) {
    const pause = await getNightPause(supabase);
    const ext = await setting(supabase, "ship_extension_hours", 3);
    const due = addActiveHours(currentDue, ext, pause);
    return { due, schedule: [addActiveHours(currentDue, Math.max(0, ext - 1), pause)] };
}

/** A4: shipped → arrived. Wall-clock hours; window depends on distance. */
export async function deliverClock(supabase: SupabaseClient, orderId: string, from: Date, overrideHours?: number) {
    const hours = overrideHours ?? await deliveryWindowHours(supabase, orderId);
    const due = addHours(from, hours);
    return { due, schedule: await deliverCheckins(supabase, due), hours };
}

export async function deliverCheckins(supabase: SupabaseClient, due: Date): Promise<Date[]> {
    const checkins = await setting<number[]>(supabase, "deliver_checkin_hours", [6, 2]);
    return checkins.map((h) => addHours(due, -h));
}

/** Arrived → auto-release. Daytime hours only; second prompt before release. */
export async function releaseClock(supabase: SupabaseClient, from: Date) {
    const pause = await getNightPause(supabase);
    const [windowHours, secondPrompt] = await Promise.all([
        setting(supabase, "release_window_hours", 6),
        setting(supabase, "release_second_prompt_hours", 2),
    ]);
    return {
        due: addActiveHours(from, windowHours, pause),
        schedule: [addActiveHours(from, Math.max(0, windowHours - secondPrompt), pause)],
    };
}

function norm(s: string | null | undefined): string {
    return (s ?? "").trim().toLowerCase().replace(/\s+county$/, "");
}

/** Picks the A4 window from the vendor's and buyer's town/county. */
export async function deliveryWindowHours(supabase: SupabaseClient, orderId: string): Promise<number> {
    const { data: order } = await supabase
        .from("orders")
        .select("vendor_id, order_shipping_details(city, county)")
        .eq("id", orderId)
        .single();
    const shipping = Array.isArray(order?.order_shipping_details) ? order?.order_shipping_details[0] : order?.order_shipping_details;
    const { data: vendor } = await supabase
        .from("profiles")
        .select("vendor_city, vendor_county")
        .eq("id", order?.vendor_id)
        .maybeSingle();

    const [sameTown, sameCounty, otherCounty, far, farCounties] = await Promise.all([
        setting(supabase, "deliver_same_town_hours", 24),
        setting(supabase, "deliver_same_county_hours", 24),
        setting(supabase, "deliver_other_county_hours", 48),
        setting(supabase, "deliver_far_hours", 72),
        setting<string[]>(supabase, "far_counties", []),
    ]);

    const vTown = norm(vendor?.vendor_city), bTown = norm(shipping?.city);
    const vCounty = norm(vendor?.vendor_county), bCounty = norm(shipping?.county);

    if (vTown && vTown === bTown) return sameTown;
    if (vCounty && vCounty === bCounty) return sameCounty;
    const farSet = new Set(farCounties.map(norm));
    if (farSet.has(vCounty) || farSet.has(bCounty)) return far;
    // Missing location data falls back to the longer in-Kenya window so a
    // vendor is never refunded early because a field was blank.
    if (!vCounty || !bCounty) return Math.max(otherCounty, far);
    return otherCounty;
}
