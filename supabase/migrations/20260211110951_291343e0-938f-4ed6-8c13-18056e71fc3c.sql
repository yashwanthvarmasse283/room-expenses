
-- Add UPDATE and DELETE policies for admin on chat_messages
CREATE POLICY "Admins can update chat messages"
ON public.chat_messages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) AND admin_id = get_my_profile_id());

CREATE POLICY "Admins can delete chat messages"
ON public.chat_messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) AND admin_id = get_my_profile_id());
