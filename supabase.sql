-- ==========================================
-- SCRIPT DE RESET NUCLEAR - V24 (PIN PARCEIRO & HISTORICO)
-- ==========================================

-- 1. LIMPEZA TOTAL
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_role_change() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.redeem_coupon(UUID, UUID) CASCADE;

DROP TABLE IF EXISTS public.coupon_redemptions CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.partners CASCADE;
DROP TABLE IF EXISTS public.service_categories CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. CRIAÇÃO DE TABELAS
-- ==========================================

CREATE TABLE public.service_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL
);

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  allowed_roles TEXT[] DEFAULT '{client}',
  points INTEGER DEFAULT 50,
  avatar_url TEXT,
  phone TEXT,
  cpf TEXT,
  bio TEXT,
  specialty TEXT,
  rating NUMERIC DEFAULT 5.0,
  completed_jobs INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.partners (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Geral',
  email TEXT UNIQUE,
  logo_url TEXT,
  whatsapp TEXT,
  address TEXT,
  active BOOLEAN DEFAULT TRUE,
  coupon_pin TEXT, -- NOVO CAMPO DE PIN
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL,
  total_quantity INTEGER NOT NULL,
  available_quantity INTEGER NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.coupon_redemptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  cost_paid INTEGER NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.profiles(id) NOT NULL,
  worker_id UUID REFERENCES public.profiles(id),
  category_name TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'waiting_verification', 'completed', 'cancelled')) DEFAULT 'pending',
  price DECIMAL(10,2),
  duration_hours DECIMAL(10,1),
  worker_evidence_url TEXT,
  client_evidence_url TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  type TEXT DEFAULT 'info',
  action_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. FUNÇÕES E TRIGGERS
-- ==========================================

-- 3.1 Função is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND 'admin' = ANY(allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.2 Função criar perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_role TEXT;
  initial_role TEXT;
  initial_points INTEGER;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';
  
  IF meta_role = 'worker' THEN
    initial_role := 'worker';
  ELSE
    initial_role := 'client';
  END IF;

  IF meta_role = 'partner' THEN
    initial_points := 0;
  ELSE
    initial_points := 50;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, allowed_roles, points, avatar_url, phone, cpf, specialty
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    ARRAY[initial_role],
    initial_points,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'cpf',
    NEW.raw_user_meta_data->>'specialty'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3.3 Trigger Parceiro
CREATE OR REPLACE FUNCTION public.handle_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF 'partner' = ANY(NEW.allowed_roles) AND NOT EXISTS (SELECT 1 FROM public.partners WHERE profile_id = NEW.id) THEN
    INSERT INTO public.partners (profile_id, name, email, logo_url)
    VALUES (NEW.id, NEW.full_name, NEW.email, NEW.avatar_url);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_role_change 
  AFTER UPDATE OF allowed_roles ON public.profiles 
  FOR EACH ROW EXECUTE PROCEDURE public.handle_role_change();

-- 3.4 Redeem Coupon
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_coupon_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_cost INTEGER;
  v_user_points INTEGER;
  v_available INTEGER;
BEGIN
  SELECT cost, available_quantity INTO v_cost, v_available FROM public.coupons WHERE id = p_coupon_id AND active = true;
  
  IF v_cost IS NULL THEN RETURN json_build_object('success', false, 'message', 'Cupom inválido.'); END IF;
  IF v_available <= 0 THEN RETURN json_build_object('success', false, 'message', 'Esgotado.'); END IF;

  SELECT points INTO v_user_points FROM public.profiles WHERE id = p_user_id;

  IF v_user_points < v_cost THEN RETURN json_build_object('success', false, 'message', 'Saldo insuficiente.'); END IF;

  UPDATE public.profiles SET points = points - v_cost WHERE id = p_user_id;
  UPDATE public.coupons SET available_quantity = available_quantity - 1 WHERE id = p_coupon_id;
  
  INSERT INTO public.coupon_redemptions (coupon_id, user_id, cost_paid) VALUES (p_coupon_id, p_user_id, v_cost);

  RETURN json_build_object('success', true, 'message', 'Resgate realizado!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. RLS - POLÍTICAS DE SEGURANÇA
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles Read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles Update Self" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles Update Admin" ON profiles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Profiles Insert Self" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Partners (Permitir update do proprio parceiro para PIN)
CREATE POLICY "Partners Read" ON partners FOR SELECT USING (true);
CREATE POLICY "Partners Admin All" ON partners FOR ALL USING (public.is_admin());
CREATE POLICY "Partners Self Update" ON partners FOR UPDATE USING (profile_id = auth.uid());

-- Jobs
CREATE POLICY "Jobs Read" ON jobs FOR SELECT USING (true);
CREATE POLICY "Jobs Create" ON jobs FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Jobs Update" ON jobs FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = worker_id OR public.is_admin());

-- Coupons
CREATE POLICY "Coupons Read" ON coupons FOR SELECT USING (active = true);
CREATE POLICY "Coupons Manage" ON coupons FOR ALL USING (
  EXISTS (SELECT 1 FROM partners p WHERE p.id = partner_id AND p.profile_id = auth.uid()) OR public.is_admin()
);

-- Coupon Redemptions
-- Parceiro precisa ver quem resgatou seus cupons
CREATE POLICY "Redemptions Read Partner" ON coupon_redemptions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM coupons c
    JOIN partners p ON p.id = c.partner_id
    WHERE c.id = coupon_id AND p.profile_id = auth.uid()
  ) OR user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "Redemptions Insert" ON coupon_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications
CREATE POLICY "Notif Own" ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Notif Insert" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Categories
CREATE POLICY "Read Cats" ON service_categories FOR SELECT USING (true);
CREATE POLICY "Admin Cats" ON service_categories FOR ALL USING (public.is_admin());

-- Messages
CREATE POLICY "Msg Read" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.worker_id = auth.uid() OR public.is_admin()))
);
CREATE POLICY "Msg Insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ==========================================
-- 5. DADOS INICIAIS
-- ==========================================
INSERT INTO public.service_categories (name, icon) VALUES
  ('Pedreiro', 'BrickWall'), ('Eletricista', 'Zap'), ('Encanador', 'Wrench'),
  ('Pintor', 'PaintBucket'), ('Jardinagem', 'Sprout'), ('Montador', 'Hammer'),
  ('Limpeza', 'Sparkles'), ('Serviços Gerais', 'Briefcase'), ('Tecnologia', 'Monitor')
ON CONFLICT DO NOTHING;
