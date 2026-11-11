/**
 * Kenya-time clock arithmetic with a nightly pause.
 *
 * Vendor clocks (A1 shipping) and the payment-release window only count
 * daytime hours: by default the clock stops at 18:00 and resumes at 07:00
 * Kenya time (UTC+3, no daylight saving). An order accepted at 17:00 with
 * an 8h deadline is therefore due at 14:00 the next day, not 01:00.
 */

const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface NightPause {
    /** "HH:MM" Kenya time the clock stops */
    start: string;
    /** "HH:MM" Kenya time the clock resumes */
    end: string;
}

export const DEFAULT_PAUSE: NightPause = { start: "18:00", end: "07:00" };

function minutesOf(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

/** Milliseconds since Kenya midnight for this instant. */
function kenyaMsOfDay(t: number): number {
    return (((t + KENYA_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
}

/** The UTC instant of Kenya midnight on the Kenya day containing t. */
function kenyaMidnight(t: number): number {
    return t - kenyaMsOfDay(t);
}

/** True if t falls inside the nightly pause. */
export function isPaused(t: Date, pause: NightPause = DEFAULT_PAUSE): boolean {
    const ms = kenyaMsOfDay(t.getTime());
    const s = minutesOf(pause.start) * 60_000;
    const e = minutesOf(pause.end) * 60_000;
    // Pause wraps midnight (18:00 -> 07:00).
    return s > e ? ms >= s || ms < e : ms >= s && ms < e;
}

/** If t is inside the pause, the moment the clock resumes; otherwise t. */
function resumeFrom(t: number, pause: NightPause): number {
    if (!isPaused(new Date(t), pause)) return t;
    const e = minutesOf(pause.end) * 60_000;
    const midnight = kenyaMidnight(t);
    const sameDayEnd = midnight + e;
    return t < sameDayEnd ? sameDayEnd : sameDayEnd + DAY_MS;
}

/** The next moment at or after t (which must be unpaused) the pause begins. */
function nextPauseStart(t: number, pause: NightPause): number {
    const s = minutesOf(pause.start) * 60_000;
    const midnight = kenyaMidnight(t);
    const today = midnight + s;
    return t < today ? today : today + DAY_MS;
}

/** start + `hours` of counted (daytime) time. */
export function addActiveHours(start: Date, hours: number, pause: NightPause = DEFAULT_PAUSE): Date {
    let cursor = resumeFrom(start.getTime(), pause);
    let remaining = hours * HOUR_MS;
    // Bounded: even 10 days of counted time is ~20 iterations.
    for (let i = 0; i < 1000 && remaining > 0; i++) {
        const stop = nextPauseStart(cursor, pause);
        const available = stop - cursor;
        if (remaining <= available) return new Date(cursor + remaining);
        remaining -= available;
        cursor = resumeFrom(stop, pause);
    }
    return new Date(cursor);
}

/** Plain wall-clock addition, for windows that run 24/7. */
export function addHours(start: Date, hours: number): Date {
    return new Date(start.getTime() + hours * HOUR_MS);
}

/** "2:30pm" / "tomorrow 9:00am" in Kenya time, for emails and the UI. */
export function formatKenyaTime(t: Date, now: Date = new Date()): string {
    const local = new Date(t.getTime() + KENYA_OFFSET_MS);
    let h = local.getUTCHours();
    const m = local.getUTCMinutes();
    const suffix = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    const time = `${h}:${String(m).padStart(2, "0")}${suffix}`;

    const dayDiff = Math.round((kenyaMidnight(t.getTime()) - kenyaMidnight(now.getTime())) / DAY_MS);
    if (dayDiff === 0) return `today ${time}`;
    if (dayDiff === 1) return `tomorrow ${time}`;
    const date = local.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    return `${date}, ${time}`;
}
