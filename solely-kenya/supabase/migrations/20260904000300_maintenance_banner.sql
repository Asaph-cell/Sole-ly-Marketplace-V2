-- ============================================================
-- SOFT MAINTENANCE BANNER
-- ============================================================
-- maintenance_mode is the extreme option: it locks everyone but a logged-
-- in admin out entirely. This adds a lighter second option - a dismissible
-- banner that tells visitors changes are in progress while the site stays
-- fully usable. Independent of maintenance_mode; either, both, or neither
-- can be on at once.
-- ============================================================

insert into public.platform_settings (key, value, description) values
  ('maintenance_banner_enabled', 'false', 'Shows a dismissible "changes in progress" banner without blocking the site.'),
  ('maintenance_banner_message', '"We''re making some updates right now. Everything still works, but you might notice a few changes."', 'Message shown in the maintenance banner.');
