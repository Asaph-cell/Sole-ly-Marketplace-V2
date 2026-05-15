-- Fix relationships to point to visible 'profiles' table and expose email address
-- This resolves PGRST200 errors in Admin Dashboard

-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;

-- 3. Update handle_new_user to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- 4. Create trigger to sync email updates from auth.users
CREATE OR REPLACE FUNCTION public.handle_user_email_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email,
      updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
CREATE TRIGGER on_auth_user_email_sync
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_sync();

-- 5. Fix Foreign Keys to reference public.profiles instead of auth.users
-- This enables PostgREST to see the relationship

-- Fix disputes table
ALTER TABLE public.disputes
  DROP CONSTRAINT IF EXISTS disputes_customer_id_fkey;

ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- Fix orders table (to prevent similar errors in Admin Dashboard orders view)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey; -- Name might vary if auto-generated, but usually follows this pattern

ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
