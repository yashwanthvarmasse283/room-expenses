
-- 1. Add mobile_number to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile_number text;

-- 2. Create notices table (admin notice board)
CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can CRUD notices" ON public.notices FOR ALL
  USING (has_role(auth.uid(), 'admin') AND admin_id = get_my_profile_id());

CREATE POLICY "Users can view notices" ON public.notices FOR SELECT
  USING (has_role(auth.uid(), 'user') AND admin_id = get_my_admin_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND approved = true));

-- 3. Create chat_messages table (universal room chat)
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  sender_id uuid NOT NULL,
  sender_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Admin can see all chats in their room
CREATE POLICY "Admins can view room chat" ON public.chat_messages FOR SELECT
  USING (has_role(auth.uid(), 'admin') AND admin_id = get_my_profile_id());

-- Users can see chats in their admin's room
CREATE POLICY "Users can view room chat" ON public.chat_messages FOR SELECT
  USING (has_role(auth.uid(), 'user') AND admin_id = get_my_admin_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND approved = true));

-- Anyone in the room can send
CREATE POLICY "Members can send chat" ON public.chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- 4. Update purse RLS: allow users to insert (add money & expenses)
CREATE POLICY "Users can add purse transactions" ON public.purse_transactions FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'user')
    AND admin_id = get_my_admin_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND approved = true)
  );

-- 5. Allow users to insert room expenses
CREATE POLICY "Users can add room expenses" ON public.room_expenses FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'user')
    AND admin_id = get_my_admin_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND approved = true)
  );

-- 6. Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purse_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
