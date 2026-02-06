-- ==========================================
-- MIGRAÇÃO: Anti-Fraude (Lista Vermelha) e Recursos de Punição
-- Execute após o schema base (supabase.sql) já estar aplicado.
-- ==========================================

-- PROFILES: flags e punição
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspicious_flag BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS punishment_until TIMESTAMP WITH TIME ZONE;

-- JOBS: auditoria e veredito admin
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS is_audited BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS audit_data JSONB,
  ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(10,1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS admin_verdict TEXT CHECK (admin_verdict IN ('pending', 'absolved', 'punished')),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Tabela de recursos de punição (tréplicas)
CREATE TABLE IF NOT EXISTS public.punishment_appeals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  appeal_text TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.punishment_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appeals Read Admin" ON punishment_appeals FOR SELECT USING (public.is_admin());
CREATE POLICY "Appeals Update Admin" ON punishment_appeals FOR UPDATE USING (public.is_admin());
CREATE POLICY "Appeals Insert Own" ON punishment_appeals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Appeals Read Own" ON punishment_appeals FOR SELECT USING (auth.uid() = user_id);
