-- ==============================================================================
-- MASTER SCRIPT: V26 (SEU SCRIPT ATUAL + FUNCIONALIDADES ADMIN ANTI-FRAUDE)
-- ==============================================================================

-- 1. STORAGE: Criar bucket 'avatars' de forma segura
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. POLÍTICAS DE STORAGE
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own avatar." ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can upload an avatar."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

CREATE POLICY "Anyone can update their own avatar."
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'avatars' AND auth.uid() = owner )
  WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );

-- 3. ATUALIZAÇÃO DE TABELAS PARA LOCALIZAÇÃO
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 4. COLUNAS PARA REGRAS DE NEGÓCIO E ANTI-FRAUDE (LISTA VERMELHA)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(10,1) DEFAULT 1; 
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS points_awarded INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_audited BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS audit_data JSONB DEFAULT '{}'::jsonb;
-- Novo: Veredicto do Admin para a Lista Vermelha
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS admin_verdict TEXT CHECK (admin_verdict IN ('pending', 'absolved', 'punished'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspicious_flag BOOLEAN DEFAULT FALSE; 
-- Novo: Controle de Banimento/Punição
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS punishment_until TIMESTAMP WITH TIME ZONE;

-- 5. TABELA DE SUGESTÕES DE CATEGORIA
CREATE TABLE IF NOT EXISTS category_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  suggestion TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE
);

-- 6. NOVO: TABELA DE TRÉPLICAS (PUNISHMENT APPEALS)
-- Necessária para o usuário recorrer da punição
CREATE TABLE IF NOT EXISTS punishment_appeals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  job_id UUID REFERENCES jobs(id),
  content TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS e Políticas para Tréplicas
ALTER TABLE punishment_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Appeals View Own" ON punishment_appeals;
CREATE POLICY "Appeals View Own" ON punishment_appeals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Appeals Create Own" ON punishment_appeals;
CREATE POLICY "Appeals Create Own" ON punishment_appeals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Appeals Admin All" ON punishment_appeals;
CREATE POLICY "Appeals Admin All" ON punishment_appeals FOR ALL USING (public.is_admin());

-- 7. FUNÇÃO DE RESGATE (Backend para o Scanner)
DROP FUNCTION IF EXISTS redeem_coupon(uuid, uuid);

CREATE OR REPLACE FUNCTION redeem_coupon(p_coupon_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost INT;
  v_user_points INT;
  v_available INT;
BEGIN
  -- Verificar cupom
  SELECT cost, available_quantity INTO v_cost, v_available
  FROM coupons
  WHERE id = p_coupon_id AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cupom inválido ou inativo.');
  END IF;

  IF v_available <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cupom esgotado.');
  END IF;

  -- Verificar pontos do usuário
  SELECT points INTO v_user_points
  FROM profiles
  WHERE id = p_user_id;

  IF v_user_points < v_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pontos insuficientes.');
  END IF;

  -- Deduzir pontos
  UPDATE profiles
  SET points = points - v_cost
  WHERE id = p_user_id;

  -- Atualizar quantidade
  UPDATE coupons
  SET available_quantity = available_quantity - 1
  WHERE id = p_coupon_id;

  -- Registrar resgate
  INSERT INTO coupon_redemptions (coupon_id, user_id, cost_paid, redeemed_at)
  VALUES (p_coupon_id, p_user_id, v_cost, NOW());

  RETURN jsonb_build_object('success', true, 'message', 'Resgate realizado com sucesso!');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 8. HABILITAR REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'coupon_redemptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE coupon_redemptions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- 9. RESTAURAR CATEGORIA OUTROS
INSERT INTO service_categories (name, icon)
SELECT 'Outros', 'HelpCircle'
WHERE NOT EXISTS (
    SELECT 1 FROM service_categories WHERE name = 'Outros'
);