-- Update the auto-credit trigger to support PARTIAL payments
-- New behavior: credits the wallet/purse based on the DELTA in amount_paid
-- (so paying 400 of 1000 credits 400; paying another 600 later credits 600)
-- Falls back to expected_amount or contribution_limits.amount when amount_paid is 0.

CREATE OR REPLACE FUNCTION public.auto_credit_wallet_on_contribution()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_default_amount numeric;
  v_credit_amount numeric;
  v_old_paid numeric;
  v_new_paid numeric;
BEGIN
  -- Resolve the configured term limit (fallback 500)
  SELECT COALESCE(cl.amount, COALESCE(NEW.expected_amount, 500))
    INTO v_default_amount
  FROM (SELECT 1) dummy
  LEFT JOIN public.contribution_limits cl
    ON cl.admin_id = NEW.admin_id AND cl.user_id = NEW.user_id AND cl.term = NEW.term
  LIMIT 1;

  IF v_default_amount IS NULL OR v_default_amount = 0 THEN
    v_default_amount := COALESCE(NEW.expected_amount, 500);
  END IF;

  -- Determine effective old/new paid amounts
  v_new_paid := COALESCE(NEW.amount_paid, 0);
  -- Backwards-compat: if amount_paid is 0 but `paid` flipped to true, treat as full payment
  IF v_new_paid = 0 AND NEW.paid = true THEN
    v_new_paid := v_default_amount;
  END IF;

  v_old_paid := 0;
  IF TG_OP = 'UPDATE' THEN
    v_old_paid := COALESCE(OLD.amount_paid, 0);
    IF v_old_paid = 0 AND OLD.paid = true THEN
      v_old_paid := v_default_amount;
    END IF;
  END IF;

  v_credit_amount := v_new_paid - v_old_paid;

  -- Only credit on positive delta (additional money paid)
  IF v_credit_amount > 0 THEN
    INSERT INTO public.personal_wallet (user_id, type, amount, category, date, description)
    VALUES (NEW.user_id, 'income', v_credit_amount, 'Contribution', CURRENT_DATE,
            NEW.user_name || '''s Term ' || NEW.term || ' contribution');

    INSERT INTO public.purse_transactions (admin_id, type, amount, date, description)
    VALUES (NEW.admin_id, 'inflow', v_credit_amount, CURRENT_DATE,
            NEW.user_name || ' - Term ' || NEW.term || ' contribution');
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger (idempotent)
DROP TRIGGER IF EXISTS auto_credit_on_contribution_change ON public.monthly_contributions;
CREATE TRIGGER auto_credit_on_contribution_change
AFTER INSERT OR UPDATE ON public.monthly_contributions
FOR EACH ROW EXECUTE FUNCTION public.auto_credit_wallet_on_contribution();