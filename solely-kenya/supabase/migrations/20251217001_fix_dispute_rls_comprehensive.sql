-- Fix for 'operator does not exist: app_role = text' error and reversed arguments in previous migrations.
-- This script drops ALL policies related to disputes and recreates them correctly.

-- 1. Drop potentially conflicting/broken policies from all previous migrations
-- (Including 'commission_escrow.sql', 'fix_dispute_role_error.sql', etc.)
DROP POLICY IF EXISTS "disputes_select" ON disputes;
DROP POLICY IF EXISTS "disputes_insert_customer" ON disputes;
DROP POLICY IF EXISTS "disputes_update_admin" ON disputes;
DROP POLICY IF EXISTS "Vendors can update their own disputes" ON disputes;
DROP POLICY IF EXISTS "Vendors can view their own disputes" ON disputes;
DROP POLICY IF EXISTS "Admins can view all disputes" ON disputes;
DROP POLICY IF EXISTS "Admins can update all disputes" ON disputes;

-- 2. Re-create policies with CORRECT type casting and argument order

-- SELECT: Users can see their own disputes, Admins can see all
-- Fixes: Added explicit ::app_role cast, ensures correct argument order has_role(uid, role)
CREATE POLICY "disputes_select_v2" ON disputes
FOR SELECT USING (
  auth.uid() = customer_id
  OR auth.uid() = vendor_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- INSERT: Customers can create disputes for their orders
CREATE POLICY "disputes_insert_customer_v2" ON disputes
FOR INSERT WITH CHECK (
  auth.uid() = customer_id
);

-- UPDATE: Vendors can update their own disputes
-- This was missing in some previous migrations or implemented incorrectly
CREATE POLICY "disputes_update_vendor_v2" ON disputes
FOR UPDATE USING (
  auth.uid() = vendor_id
) WITH CHECK (
  auth.uid() = vendor_id
);

-- UPDATE: Admins can update all disputes
-- Fixes: Added explicit ::app_role cast
CREATE POLICY "disputes_update_admin_v2" ON disputes
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);
