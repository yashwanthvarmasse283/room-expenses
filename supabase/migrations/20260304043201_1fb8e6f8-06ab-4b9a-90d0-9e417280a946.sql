
-- Add deactivated and view_only columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS view_only boolean NOT NULL DEFAULT false;

-- Create trigger function: auto-credit ₹500 to personal_wallet when contribution marked paid
CREATE OR REPLACE FUNCTION public.auto_credit_wallet_on_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when paid changes from false to true (or new insert with paid=true)
  IF NEW.paid = true AND (OLD IS NULL OR OLD.paid = false) THEN
    INSERT INTO public.personal_wallet (user_id, type, amount, category, date, description)
    VALUES (
      NEW.user_id,
      'income',
      500,
      'Contribution',
      CURRENT_DATE,
      NEW.user_name || '''s Term ' || NEW.term || ' payment'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on monthly_contributions for INSERT
CREATE TRIGGER trg_auto_credit_wallet_insert
AFTER INSERT ON public.monthly_contributions
FOR EACH ROW
WHEN (NEW.paid = true)
EXECUTE FUNCTION public.auto_credit_wallet_on_contribution();

-- Create trigger on monthly_contributions for UPDATE
CREATE TRIGGER trg_auto_credit_wallet_update
AFTER UPDATE OF paid ON public.monthly_contributions
FOR EACH ROW
WHEN (OLD.paid = false AND NEW.paid = true)
EXECUTE FUNCTION public.auto_credit_wallet_on_contribution();
