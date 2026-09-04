-- ============================================================
-- CRITICAL: LOCK DOWN assign_admin_role
-- ============================================================
-- assign_admin_role(_user_email text) is SECURITY DEFINER and does no
-- caller check of its own - it was executable by `anon` and `authenticated`
-- (Postgres grants EXECUTE to PUBLIC by default, and nothing ever revoked
-- it here). Any visitor, logged in or not, could call
-- supabase.rpc('assign_admin_role', { _user_email: 'them@x.com' }) from
-- the browser and grant themselves full admin access. Only service_role
-- (used exclusively by the admin-action edge function, which does its own
-- caller-is-admin check first) should ever be able to call this.
-- ============================================================

revoke execute on function public.assign_admin_role(text) from public, anon, authenticated;
