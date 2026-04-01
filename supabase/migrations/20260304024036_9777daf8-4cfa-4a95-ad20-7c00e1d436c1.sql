
-- Drop the whatsapp notification trigger function and any triggers referencing it
DROP FUNCTION IF EXISTS public.notify_whatsapp() CASCADE;
