-- ============================================================
-- Admin removal + admin count cap
-- ============================================================
-- 1. Adds 'revoke_admin' as a valid admin_activity_log action_type, for
--    the new admin-action case that removes the admin role.
-- 2. Adds `max_admins` to platform_settings (default 3, per the user's
--    stated policy) so the cap is admin-editable later, not another
--    hardcoded literal.
-- ============================================================

alter table public.admin_activity_log drop constraint admin_activity_log_action_type_check;
alter table public.admin_activity_log add constraint admin_activity_log_action_type_check
  check (action_type in (
    'pause_product','restore_product','delete_product',
    'penalize_vendor','revoke_vendor','restore_vendor',
    'resolve_dispute_release','resolve_dispute_refund',
    'resolve_dispute_partial_refund','resolve_dispute_close',
    'update_platform_setting','promote_to_admin','revoke_admin'
  ));

insert into public.platform_settings (key, value, description) values
  ('max_admins', '3', 'Maximum number of accounts that can hold the admin role at once.');
