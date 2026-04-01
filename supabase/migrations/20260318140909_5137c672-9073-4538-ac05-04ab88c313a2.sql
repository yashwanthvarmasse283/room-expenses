-- Fix: Drop ALL 5 duplicate triggers, keep only ONE
DROP TRIGGER IF EXISTS auto_credit_wallet_contribution ON public.monthly_contributions;
DROP TRIGGER IF EXISTS trg_auto_credit_wallet ON public.monthly_contributions;
DROP TRIGGER IF EXISTS trg_auto_credit_wallet_insert ON public.monthly_contributions;
DROP TRIGGER IF EXISTS trg_auto_credit_wallet_update ON public.monthly_contributions;
DROP TRIGGER IF EXISTS trigger_auto_credit_wallet ON public.monthly_contributions;

-- Recreate single trigger
CREATE TRIGGER trg_auto_credit_wallet
  AFTER INSERT OR UPDATE ON public.monthly_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_credit_wallet_on_contribution();

-- Add per-day-of-week daily limits (JSON: {"mon": 500, "tue": 300, ...})
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_limits_by_day jsonb DEFAULT '{}';

-- Add monthly budget target for admin
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_budget_target numeric DEFAULT 0;

-- Add pinned flag for notices
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;

-- Add created_by_name to room_expenses for audit trail
ALTER TABLE public.room_expenses ADD COLUMN IF NOT EXISTS created_by_name text;