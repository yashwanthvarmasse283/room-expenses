
-- Update the auto_credit_wallet trigger to also add to purse_transactions
CREATE OR REPLACE FUNCTION public.auto_credit_wallet_on_contribution()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Only fire when paid changes from false to true (or new insert with paid=true)
  IF NEW.paid = true AND (OLD IS NULL OR OLD.paid = false) THEN
    -- Credit user's personal wallet with ₹500
    INSERT INTO public.personal_wallet (user_id, type, amount, category, date, description)
    VALUES (
      NEW.user_id,
      'income',
      500,
      'Contribution',
      CURRENT_DATE,
      NEW.user_name || '''s Term ' || NEW.term || ' payment'
    );

    -- Also add ₹500 to the room purse as inflow
    INSERT INTO public.purse_transactions (admin_id, type, amount, date, description)
    VALUES (
      NEW.admin_id,
      'inflow',
      500,
      CURRENT_DATE,
      NEW.user_name || ' - Term ' || NEW.term || ' contribution'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trg_auto_credit_wallet ON public.monthly_contributions;
CREATE TRIGGER trg_auto_credit_wallet
  AFTER INSERT OR UPDATE ON public.monthly_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_credit_wallet_on_contribution();
