
-- 1. Allow anonymous users to look up admin codes during signup (fixes "Invalid Room ID")
CREATE POLICY "Anyone can lookup admin code for signup"
ON public.profiles
FOR SELECT
TO anon
USING (admin_code IS NOT NULL);

-- 2. Three-state user moderation: blocked (permanent) + banned_until (timed) + deactivated (existing)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_marker boolean NOT NULL DEFAULT false;

-- 3. Soft delete for room_expenses (Recently Deleted page)
ALTER TABLE public.room_expenses
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_room_expenses_deleted_at ON public.room_expenses(deleted_at);

-- 4. Partial payments on monthly_contributions
ALTER TABLE public.monthly_contributions
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_amount numeric NOT NULL DEFAULT 0;
