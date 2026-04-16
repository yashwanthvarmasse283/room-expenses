
-- Add default_price and active columns to groceries
ALTER TABLE public.groceries
  ADD COLUMN IF NOT EXISTS default_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Create item_budgets table for per-item monthly budgets
CREATE TABLE public.item_budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  grocery_id uuid NOT NULL,
  monthly_budget numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.item_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage item budgets"
  ON public.item_budgets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND admin_id = get_my_profile_id());

CREATE POLICY "Users view item budgets"
  ON public.item_budgets FOR SELECT
  USING (has_role(auth.uid(), 'user'::app_role) AND admin_id = get_my_admin_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.approved = true));

CREATE UNIQUE INDEX idx_item_budgets_unique ON public.item_budgets (admin_id, grocery_id);
