
-- Drop ALL existing triggers on monthly_contributions to fix triple-entry bug
DROP TRIGGER IF EXISTS trigger_auto_credit_wallet_insert ON public.monthly_contributions;
DROP TRIGGER IF EXISTS trigger_auto_credit_wallet_update ON public.monthly_contributions;
DROP TRIGGER IF EXISTS auto_credit_wallet_contribution ON public.monthly_contributions;

-- Recreate a single clean trigger function with idempotency
CREATE OR REPLACE FUNCTION public.auto_credit_wallet_on_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amount numeric;
  v_exists boolean;
BEGIN
  -- Only process when paid changes to true
  IF NEW.paid = true AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.paid = false)) THEN
    -- Get dynamic contribution limit
    SELECT COALESCE(cl.amount, 500) INTO v_amount
    FROM public.contribution_limits cl
    WHERE cl.admin_id = NEW.admin_id AND cl.user_id = NEW.user_id AND cl.term = NEW.term
    LIMIT 1;

    IF v_amount IS NULL THEN
      v_amount := 500;
    END IF;

    -- Idempotency: check if wallet entry already exists for this contribution
    SELECT EXISTS(
      SELECT 1 FROM public.personal_wallet
      WHERE user_id = NEW.user_id
        AND description = NEW.user_name || '''s Term ' || NEW.term || ' contribution'
        AND category = 'Contribution'
    ) INTO v_exists;

    IF NOT v_exists THEN
      -- Credit user wallet
      INSERT INTO public.personal_wallet (user_id, type, amount, category, date, description)
      VALUES (NEW.user_id, 'income', v_amount, 'Contribution', now()::date::text,
              NEW.user_name || '''s Term ' || NEW.term || ' contribution');
    END IF;

    -- Idempotency: check if purse entry already exists
    SELECT EXISTS(
      SELECT 1 FROM public.purse_transactions
      WHERE admin_id = NEW.admin_id
        AND description = NEW.user_name || ' - Term ' || NEW.term || ' contribution'
        AND type = 'inflow'
    ) INTO v_exists;

    IF NOT v_exists THEN
      -- Credit room purse
      INSERT INTO public.purse_transactions (admin_id, type, amount, date, description)
      VALUES (NEW.admin_id, 'inflow', v_amount, now()::date::text,
              NEW.user_name || ' - Term ' || NEW.term || ' contribution');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create single trigger
CREATE TRIGGER auto_credit_wallet_contribution
  AFTER INSERT OR UPDATE ON public.monthly_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_credit_wallet_on_contribution();

-- Update room_expenses category constraint to allow any text (for custom categories)
ALTER TABLE public.room_expenses DROP CONSTRAINT IF EXISTS room_expenses_category_check;
