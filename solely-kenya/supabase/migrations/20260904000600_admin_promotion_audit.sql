-- ============================================================
-- Widen admin_activity_log for promote_to_admin
-- ============================================================
-- Adds 'user' as a target_type (a promoted account isn't a product,
-- vendor, dispute, or settings key) and 'promote_to_admin' as an
-- action_type, so granting admin access goes through the same
-- audited admin-action choke point as everything else.
-- ============================================================

alter table public.admin_activity_log drop constraint admin_activity_log_target_type_check;
alter table public.admin_activity_log add constraint admin_activity_log_target_type_check
  check (target_type in ('product','vendor','dispute','setting','user'));

alter table public.admin_activity_log drop constraint admin_activity_log_action_type_check;
alter table public.admin_activity_log add constraint admin_activity_log_action_type_check
  check (action_type in (
    'pause_product','restore_product','delete_product',
    'penalize_vendor','revoke_vendor','restore_vendor',
    'resolve_dispute_release','resolve_dispute_refund',
    'resolve_dispute_partial_refund','resolve_dispute_close',
    'update_platform_setting','promote_to_admin'
  ));
