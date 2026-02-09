
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  admin_code TEXT UNIQUE, -- unique admin ID for user signup
  admin_id UUID REFERENCES public.profiles(id), -- which admin this user belongs to
  approved BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Room expenses
CREATE TABLE public.room_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL CHECK (category IN ('Food', 'Rent', 'Electricity', 'Internet', 'Misc')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  paid_by TEXT,
  split_among TEXT[] DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.room_expenses ENABLE ROW LEVEL SECURITY;

-- 5. Personal expenses
CREATE TABLE public.personal_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL CHECK (category IN ('Travel', 'Shopping', 'Food', 'Health', 'Entertainment', 'Others')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_expenses ENABLE ROW LEVEL SECURITY;

-- 6. Purse transactions
CREATE TABLE public.purse_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('inflow', 'outflow')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purse_transactions ENABLE ROW LEVEL SECURITY;

-- 7. Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_user_name TEXT NOT NULL,
  to_admin_id UUID REFERENCES public.profiles(id) NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 8. Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 9. Helper function: has_role (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 10. Helper: get admin profile id for current user
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 11. Helper: get admin_id for current user (if user role)
CREATE OR REPLACE FUNCTION public.get_my_admin_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 12. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_room_expenses_updated_at BEFORE UPDATE ON public.room_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_expenses_updated_at BEFORE UPDATE ON public.personal_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== RLS POLICIES ==========

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view their users" ON public.profiles FOR SELECT USING (
  admin_id = public.get_my_profile_id() OR id = public.get_my_profile_id()
);
CREATE POLICY "Users can view their admin" ON public.profiles FOR SELECT USING (
  id = public.get_my_admin_id()
);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can update their users" ON public.profiles FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin') AND admin_id = public.get_my_profile_id()
);
CREATE POLICY "Profile created via trigger" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());

-- USER_ROLES
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ROOM_EXPENSES
CREATE POLICY "Admins can CRUD room expenses" ON public.room_expenses FOR ALL USING (
  public.has_role(auth.uid(), 'admin') AND admin_id = public.get_my_profile_id()
);
CREATE POLICY "Users can view their admin room expenses" ON public.room_expenses FOR SELECT USING (
  public.has_role(auth.uid(), 'user') AND admin_id = public.get_my_admin_id()
  AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND approved = true)
);

-- PERSONAL_EXPENSES
CREATE POLICY "Users manage own personal expenses" ON public.personal_expenses FOR ALL USING (user_id = auth.uid());

-- PURSE_TRANSACTIONS
CREATE POLICY "Admins manage purse" ON public.purse_transactions FOR ALL USING (
  public.has_role(auth.uid(), 'admin') AND admin_id = public.get_my_profile_id()
);
CREATE POLICY "Users can view purse" ON public.purse_transactions FOR SELECT USING (
  public.has_role(auth.uid(), 'user') AND admin_id = public.get_my_admin_id()
  AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND approved = true)
);

-- MESSAGES
CREATE POLICY "Senders can view own messages" ON public.messages FOR SELECT USING (from_user_id = auth.uid());
CREATE POLICY "Admins can view received messages" ON public.messages FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') AND to_admin_id = public.get_my_profile_id()
);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "Admins can update messages (reply)" ON public.messages FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin') AND to_admin_id = public.get_my_profile_id()
);

-- NOTIFICATIONS
CREATE POLICY "Users see own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- Storage bucket for bill images
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-images', 'expense-images', true);
CREATE POLICY "Authenticated users can upload images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'expense-images' AND auth.role() = 'authenticated');
CREATE POLICY "Anyone can view expense images" ON storage.objects FOR SELECT USING (bucket_id = 'expense-images');
CREATE POLICY "Owners can delete images" ON storage.objects FOR DELETE USING (bucket_id = 'expense-images' AND auth.uid()::text = (storage.foldername(name))[1]);
