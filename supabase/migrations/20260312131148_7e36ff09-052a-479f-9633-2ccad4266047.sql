
-- 1. Fix Water category constraint
ALTER TABLE public.room_expenses DROP CONSTRAINT IF EXISTS room_expenses_category_check;
ALTER TABLE public.room_expenses ADD CONSTRAINT room_expenses_category_check 
  CHECK (category = ANY (ARRAY['Food','Water','Rent','Electricity','Internet','Misc']));

-- 2. Virtual Roommates table
CREATE TABLE public.virtual_roommates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.virtual_roommates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage virtual roommates" ON public.virtual_roommates FOR ALL USING (has_role(auth.uid(), 'admin') AND admin_id = get_my_profile_id());
CREATE POLICY "Users view virtual roommates" ON public.virtual_roommates FOR SELECT USING (has_role(auth.uid(), 'user') AND admin_id = get_my_admin_id() AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

-- 3. Contribution limits table (per user per term)
CREATE TABLE public.contribution_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  amount NUMERIC NOT NULL DEFAULT 500 CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(admin_id, user_id, term)
);
ALTER TABLE public.contribution_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contribution limits" ON public.contribution_limits FOR ALL USING (has_role(auth.uid(), 'admin') AND admin_id = get_my_profile_id());
CREATE POLICY "Users view own limits" ON public.contribution_limits FOR SELECT USING (has_role(auth.uid(), 'user') AND admin_id = get_my_admin_id() AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

-- 4. Settlements table
CREATE TABLE public.settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  settled BOOLEAN NOT NULL DEFAULT false,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settlements" ON public.settlements FOR ALL USING (has_role(auth.uid(), 'admin') AND admin_id = get_my_profile_id());
CREATE POLICY "Users view settlements" ON public.settlements FOR SELECT USING (has_role(auth.uid(), 'user') AND admin_id = get_my_admin_id() AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));
CREATE POLICY "Users insert settlements" ON public.settlements FOR INSERT WITH CHECK (has_role(auth.uid(), 'user') AND admin_id = get_my_admin_id() AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));
CREATE POLICY "Users update own settlements" ON public.settlements FOR UPDATE USING (has_role(auth.uid(), 'user') AND admin_id = get_my_admin_id() AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

-- 5. Update trigger to use dynamic contribution amounts from contribution_limits
CREATE OR REPLACE FUNCTION public.auto_credit_wallet_on_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_amount NUMERIC;
BEGIN
  IF NEW.paid = true AND (OLD IS NULL OR OLD.paid = false) THEN
    -- Get configured limit or default to 500
    SELECT COALESCE(cl.amount, 500) INTO v_amount
    FROM public.contribution_limits cl
    WHERE cl.admin_id = NEW.admin_id AND cl.user_id = NEW.user_id AND cl.term = NEW.term;
    
    IF v_amount IS NULL THEN
      v_amount := 500;
    END IF;

    -- Credit user's personal wallet
    INSERT INTO public.personal_wallet (user_id, type, amount, category, date, description)
    VALUES (NEW.user_id, 'income', v_amount, 'Contribution', CURRENT_DATE, NEW.user_name || '''s Term ' || NEW.term || ' payment');

    -- Credit room purse
    INSERT INTO public.purse_transactions (admin_id, type, amount, date, description)
    VALUES (NEW.admin_id, 'inflow', v_amount, CURRENT_DATE, NEW.user_name || ' - Term ' || NEW.term || ' contribution');
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_auto_credit_wallet ON public.monthly_contributions;
CREATE TRIGGER trigger_auto_credit_wallet
  AFTER INSERT OR UPDATE ON public.monthly_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_credit_wallet_on_contribution();
