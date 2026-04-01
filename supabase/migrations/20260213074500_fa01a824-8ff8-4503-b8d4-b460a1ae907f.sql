
-- Add daily_food_budget column to profiles (admin setting)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_food_budget numeric NOT NULL DEFAULT 120;
