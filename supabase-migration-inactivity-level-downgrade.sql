-- ==========================================
-- Regra: 30 dias sem usar o app = desce um nível
-- ==========================================

-- Coluna para última atividade (atualizada quando o profissional usa o app)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON COLUMN public.profiles.last_active_at IS 'Última vez que o usuário usou o app (ex.: abrir dashboard). Usado para regra de 30 dias sem uso = desce um nível.';

-- Função: desce um nível para workers inativos há 30+ dias (máximo 1 vez por período)
CREATE OR REPLACE FUNCTION public.apply_inactivity_level_downgrade()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  new_level TEXT;
BEGIN
  FOR r IN
    SELECT id, level, last_active_at
    FROM public.profiles
    WHERE allowed_roles @> ARRAY['worker']::text[]
      AND (level_admin_override IS NOT TRUE)
      AND (last_active_at IS NULL OR last_active_at < (NOW() - INTERVAL '30 days'))
      AND level IS NOT NULL
      AND level != 'bronze'
  LOOP
    new_level := CASE r.level
      WHEN 'diamond' THEN 'gold'
      WHEN 'gold' THEN 'silver'
      WHEN 'silver' THEN 'bronze'
      ELSE 'bronze'
    END;
    UPDATE public.profiles
    SET level = new_level,
        last_active_at = NOW()
    WHERE id = r.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.apply_inactivity_level_downgrade() IS 'Desce um nível para profissionais que não usaram o app nos últimos 30 dias. Rodar diariamente (pg_cron ou Supabase Edge).';
