-- Assign admin role to your account (safe: skips if user hasn't registered yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'asaphisweka@gmail.com') THEN
    PERFORM public.assign_admin_role('asaphisweka@gmail.com');
  END IF;
END $$;