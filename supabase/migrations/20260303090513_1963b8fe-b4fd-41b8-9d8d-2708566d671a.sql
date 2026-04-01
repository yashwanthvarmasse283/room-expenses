
-- Add personal daily limit to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personal_daily_limit numeric NOT NULL DEFAULT 0;

-- Create personal_wallet table for independent personal ledger
CREATE TABLE public.personal_wallet (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric NOT NULL,
  category text NOT NULL DEFAULT 'Personal',
  description text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wallet" ON public.personal_wallet
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Add RLS policy for users to delete own chat messages
CREATE POLICY "Users can delete own chat messages" ON public.chat_messages
FOR DELETE USING (sender_id = auth.uid());

-- Add admin_contributions_enabled to profiles for admin contribution toggle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_contributions_enabled boolean NOT NULL DEFAULT true;
