
-- Create a function to call the whatsapp-notify edge function
CREATE OR REPLACE FUNCTION public.notify_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  edge_url text;
  service_key text;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW)
  );

  -- Get the Supabase URL from the config
  edge_url := 'https://kzkzboprobefassrckad.supabase.co/functions/v1/whatsapp-notify';
  service_key := current_setting('app.settings.service_role_key', true);

  -- Use pg_net to call the edge function asynchronously
  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(service_key, '')
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block the insert if notification fails
  RETURN NEW;
END;
$$;

-- Create triggers for each table
CREATE TRIGGER notify_whatsapp_room_expenses
  AFTER INSERT ON public.room_expenses
  FOR EACH ROW EXECUTE FUNCTION public.notify_whatsapp();

CREATE TRIGGER notify_whatsapp_purse_transactions
  AFTER INSERT ON public.purse_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_whatsapp();

CREATE TRIGGER notify_whatsapp_notices
  AFTER INSERT ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.notify_whatsapp();

CREATE TRIGGER notify_whatsapp_chat_messages
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_whatsapp();
