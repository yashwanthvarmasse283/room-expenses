
-- Remove the overly broad anon policy
DROP POLICY IF EXISTS "Anyone can lookup admin code for signup" ON public.profiles;

-- Safe lookup function: returns ONLY the admin's profile id, nothing else
CREATE OR REPLACE FUNCTION public.lookup_admin_by_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles
  WHERE admin_code IS NOT NULL
    AND lower(admin_code) = lower(trim(_code))
  LIMIT 1
$$;

-- Allow anonymous + authenticated to call it
GRANT EXECUTE ON FUNCTION public.lookup_admin_by_code(text) TO anon, authenticated;
