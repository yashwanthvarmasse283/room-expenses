
-- 1. Monthly Contributions table
CREATE TABLE public.monthly_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  term integer NOT NULL CHECK (term IN (1, 2, 3)),
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamp with time zone,
  marked_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (admin_id, user_id, year, month, term)
);

ALTER TABLE public.monthly_contributions ENABLE ROW LEVEL SECURITY;

-- Admins: full CRUD
CREATE POLICY "Admins manage contributions"
ON public.monthly_contributions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND admin_id = get_my_profile_id());

-- Users: can view their room's contributions
CREATE POLICY "Users can view contributions"
ON public.monthly_contributions FOR SELECT
USING (has_role(auth.uid(), 'user'::app_role) AND admin_id = get_my_admin_id()
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

-- Users: can insert/update their own contribution records
CREATE POLICY "Users can mark own contributions"
ON public.monthly_contributions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'user'::app_role) AND user_id = auth.uid() AND admin_id = get_my_admin_id()
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

CREATE POLICY "Users can update own contributions"
ON public.monthly_contributions FOR UPDATE
USING (has_role(auth.uid(), 'user'::app_role) AND user_id = auth.uid() AND admin_id = get_my_admin_id()
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

-- 2. Recurring Bills table
CREATE TABLE public.recurring_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  name text NOT NULL,
  amount numeric NOT NULL,
  due_day integer NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  category text NOT NULL DEFAULT 'Bills',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage recurring bills"
ON public.recurring_bills FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND admin_id = get_my_profile_id());

CREATE POLICY "Users can view recurring bills"
ON public.recurring_bills FOR SELECT
USING (has_role(auth.uid(), 'user'::app_role) AND admin_id = get_my_admin_id()
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

-- 3. Food Toggle (Who's Home) table
CREATE TABLE public.food_toggle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  eating_home boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (admin_id, user_id, date)
);

ALTER TABLE public.food_toggle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage food toggle"
ON public.food_toggle FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND admin_id = get_my_profile_id());

CREATE POLICY "Users can view food toggle"
ON public.food_toggle FOR SELECT
USING (has_role(auth.uid(), 'user'::app_role) AND admin_id = get_my_admin_id()
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

CREATE POLICY "Users can insert own food toggle"
ON public.food_toggle FOR INSERT
WITH CHECK (has_role(auth.uid(), 'user'::app_role) AND user_id = auth.uid() AND admin_id = get_my_admin_id()
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

CREATE POLICY "Users can update own food toggle"
ON public.food_toggle FOR UPDATE
USING (has_role(auth.uid(), 'user'::app_role) AND user_id = auth.uid() AND admin_id = get_my_admin_id()
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

-- Triggers for updated_at
CREATE TRIGGER update_monthly_contributions_updated_at
BEFORE UPDATE ON public.monthly_contributions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_bills_updated_at
BEFORE UPDATE ON public.recurring_bills
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_food_toggle_updated_at
BEFORE UPDATE ON public.food_toggle
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
