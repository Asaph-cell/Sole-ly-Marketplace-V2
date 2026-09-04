-- ============================================================
-- SIGNUP ATTRIBUTION
-- ============================================================
-- No way to see where a signup came from (Instagram, direct, a shared
-- link, etc). Nullable and best-effort by design: existing rows stay
-- NULL (we never tracked this for them, and backfilling would be a
-- guess), and new rows only get a value when the browser actually
-- exposes a referrer/UTM param - many mobile in-app browsers strip
-- document.referrer entirely. See src/lib/attribution.ts.
-- ============================================================

alter table public.profiles add column signup_source text;
