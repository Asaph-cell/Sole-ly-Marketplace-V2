-- check_price_drop_alerts() marked alerts as notified and switched them off
-- without sending anything, so if it were ever scheduled it would silently
-- swallow every buyer's alert. Price drops are now sent by the
-- notify-price-drop edge function, which notifies first and then marks.
drop function if exists public.check_price_drop_alerts();
