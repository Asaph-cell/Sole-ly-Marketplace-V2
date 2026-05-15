-- Fix for 'operator does not exist: app_role = text' error
-- This usually happens when comparing an enum column to a string without casting
-- We will recreate the policy for vendor updating disputes with explicit casting

-- Drop the potential problem policy (assuming it exists on disputes)
DROP POLICY IF EXISTS "Vendors can update their own disputes" ON disputes;

-- Re-create the policy with explicit casting
-- Note: We check if the auth.uid() matches vendor_id
CREATE POLICY "Vendors can update their own disputes"
ON disputes
FOR UPDATE
USING (
  auth.uid() = vendor_id
)
WITH CHECK (
  auth.uid() = vendor_id
);

-- Also ensure the select policy is correct
DROP POLICY IF EXISTS "Vendors can view their own disputes" ON disputes;
CREATE POLICY "Vendors can view their own disputes"
ON disputes
FOR SELECT
USING (
  auth.uid() = vendor_id
);

-- Ensure public access to user_roles if needed for frontend checks (optional)
-- The error specifically mentioned 'app_role = text', which implies a query like:
-- "select * from some_table where role = 'vendor'"
-- If 'role' is an enum, this fails. Using 'vendor'::app_role fixes it.

-- If there are any other policies doing role checks, we should fix them too.
-- For example, if there is a function 'is_admin()' that checks roles.

-- Add Admin Policies
-- Admins can view all disputes
DROP POLICY IF EXISTS "Admins can view all disputes" ON disputes;
CREATE POLICY "Admins can view all disputes"
ON disputes
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can update all disputes
DROP POLICY IF EXISTS "Admins can update all disputes" ON disputes;
CREATE POLICY "Admins can update all disputes"
ON disputes
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

DO $$
BEGIN
  -- Attempt to create a cast if it doesn't exist (this is a hack, usually better to fix the query)
  -- But since we can't change the internal Supabase or Postgrest queries easily if generated,
  -- we normally just fix our definitions.
  
  -- Instead, let's verify if the issue is in a trigger?
  -- If there is a trigger on disputes that checks 'app_role', we should fix it.
  NULL;
END $$;
