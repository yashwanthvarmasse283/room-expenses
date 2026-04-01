-- Fix the trigger: use proper date type instead of text cast
CREATE OR REPLACE FUNCTION public.auto_credit_wallet_on_contribution()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_amount numeric;
  v_exists boolean;
BEGIN
  IF NEW.paid = true AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.paid = false)) THEN
    SELECT COALESCE(cl.amount, 500) INTO v_amount
    FROM public.contribution_limits cl
    WHERE cl.admin_id = NEW.admin_id AND cl.user_id = NEW.user_id AND cl.term = NEW.term
    LIMIT 1;

    IF v_amount IS NULL THEN
      v_amount := 500;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.personal_wallet
      WHERE user_id = NEW.user_id
        AND description = NEW.user_name || '''s Term ' || NEW.term || ' contribution'
        AND category = 'Contribution'
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO public.personal_wallet (user_id, type, amount, category, date, description)
      VALUES (NEW.user_id, 'income', v_amount, 'Contribution', CURRENT_DATE,
              NEW.user_name || '''s Term ' || NEW.term || ' contribution');
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.purse_transactions
      WHERE admin_id = NEW.admin_id
        AND description = NEW.user_name || ' - Term ' || NEW.term || ' contribution'
        AND type = 'inflow'
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO public.purse_transactions (admin_id, type, amount, date, description)
      VALUES (NEW.admin_id, 'inflow', v_amount, CURRENT_DATE,
              NEW.user_name || ' - Term ' || NEW.term || ' contribution');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create groceries table
CREATE TABLE IF NOT EXISTS public.groceries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.groceries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage groceries" ON public.groceries FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND admin_id = get_my_profile_id());

CREATE POLICY "Users view groceries" ON public.groceries FOR SELECT
  USING (has_role(auth.uid(), 'user'::app_role) AND admin_id = get_my_admin_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true
  ));

CREATE POLICY "Users insert groceries" ON public.groceries FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'user'::app_role) AND admin_id = get_my_admin_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true
  ));

-- Create expense_grocery_items join table
CREATE TABLE IF NOT EXISTS public.expense_grocery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL,
  grocery_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_grocery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage expense_grocery_items" ON public.expense_grocery_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM room_expenses re WHERE re.id = expense_id AND re.admin_id = get_my_profile_id()
  ));

CREATE POLICY "Users view expense_grocery_items" ON public.expense_grocery_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM room_expenses re WHERE re.id = expense_id AND re.admin_id = get_my_admin_id()
  ));

CREATE POLICY "Users insert expense_grocery_items" ON public.expense_grocery_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM room_expenses re WHERE re.id = expense_id AND re.admin_id = get_my_admin_id()
  ));