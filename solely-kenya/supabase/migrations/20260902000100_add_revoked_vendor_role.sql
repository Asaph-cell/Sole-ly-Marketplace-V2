-- ============================================================
-- ADD 'revoked_vendor' TO app_role
-- ============================================================
-- admin-action's revoke_vendor currently DELETEs the vendor's user_roles
-- row outright, which means a revoked vendor vanishes from AdminVendors.tsx's
-- list entirely (it's built by querying user_roles for role='vendor') with
-- no way to find/restore them. The fix is a role swap instead of delete+
-- insert, which needs this enum value to exist first.
-- ============================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'revoked_vendor';
