import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState that survives reloads, app switches and the Android app being
 * killed in the background. Used for drafts (listing a product, checkout
 * details) and filters, so nobody has to start over after an interruption.
 *
 * Values are namespaced under "solely:draft:" and expire after `ttlMs`
 * (default 7 days) so a months-old half-draft never resurfaces.
 */

const PREFIX = "solely:draft:";
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;

interface Stored<T> {
  v: T;
  t: number;
}

interface Options {
  ttlMs?: number;
  /** "session" keeps it for this tab only (e.g. scroll/filter state). */
  storage?: "local" | "session";
  /** Skip persisting entirely (e.g. while a user id is still loading). */
  disabled?: boolean;
}

function store(kind: Options["storage"]): Storage | null {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null; // private mode / blocked storage
  }
}

export function readDraft<T>(key: string, opts: Options = {}): T | undefined {
  const s = store(opts.storage);
  if (!s) return undefined;
  try {
    const raw = s.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (Date.now() - parsed.t > (opts.ttlMs ?? DEFAULT_TTL)) {
      s.removeItem(PREFIX + key);
      return undefined;
    }
    return parsed.v;
  } catch {
    return undefined;
  }
}

export function writeDraft<T>(key: string, value: T, opts: Options = {}) {
  const s = store(opts.storage);
  if (!s) return;
  try {
    s.setItem(PREFIX + key, JSON.stringify({ v: value, t: Date.now() } satisfies Stored<T>));
  } catch {
    // Quota exceeded: losing a draft is better than crashing the form.
  }
}

export function clearDraft(key: string, opts: Pick<Options, "storage"> = {}) {
  try {
    store(opts.storage)?.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
  opts: Options = {},
): [T, Dispatch<SetStateAction<T>>, { restored: boolean; clear: () => void }] {
  const { disabled, storage, ttlMs } = opts;
  const initialRef = useRef(initial);

  const [restored] = useState(() => !disabled && readDraft<T>(key, { storage, ttlMs }) !== undefined);
  const [value, setValue] = useState<T>(() => {
    const saved = disabled ? undefined : readDraft<T>(key, { storage, ttlMs });
    if (saved !== undefined) return saved;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  // Debounced write: typing in a description shouldn't hit storage per keystroke.
  // Untouched (still the initial value) means there's nothing worth restoring.
  useEffect(() => {
    if (disabled) return;
    const t = setTimeout(() => {
      const init = initialRef.current;
      const initValue = typeof init === "function" ? (init as () => T)() : init;
      if (JSON.stringify(value) === JSON.stringify(initValue)) clearDraft(key, { storage });
      else writeDraft(key, value, { storage });
    }, 250);
    return () => clearTimeout(t);
  }, [key, value, disabled, storage]);

  const clear = useCallback(() => {
    clearDraft(key, { storage });
    const init = initialRef.current;
    setValue(typeof init === "function" ? (init as () => T)() : init);
  }, [key, storage]);

  return [value, setValue, { restored, clear }];
}

/** Wipe every saved draft on this device, e.g. on sign-out so the next person can't see them. */
export function clearAllDrafts() {
  for (const kind of ["local", "session"] as const) {
    const s = store(kind);
    if (!s) continue;
    try {
      Object.keys(s)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => s.removeItem(k));
    } catch {
      // ignore
    }
  }
}
