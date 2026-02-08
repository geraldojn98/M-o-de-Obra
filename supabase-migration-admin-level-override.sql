-- ==========================================
-- MIGRAÇÃO: Override de Nível pelo Admin
-- Execute após supabase-migration-career-reputation.sql
-- Permite que o admin defina manualmente o nível dos profissionais.
-- ==========================================

-- Flag: quando true, a trigger NÃO sobrescreve o level (admin definiu manualmente)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level_admin_override BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.level_admin_override IS 'Quando true, o admin definiu o nível manualmente e a trigger não sobrescreve';

-- Atualizar a trigger para respeitar o override do admin
CREATE OR REPLACE FUNCTION public.update_worker_level_on_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_worker_id UUID;
  v_should_increment BOOLEAN := FALSE;
  v_new_verified INTEGER;
  v_new_level TEXT;
  v_avg_rating NUMERIC;
  v_admin_override BOOLEAN;
BEGIN
  IF NEW.worker_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.rating IS NULL THEN RETURN NEW; END IF;

  IF (OLD.rating IS NULL OR OLD.rating <= 2) AND NEW.rating > 2 THEN
    v_should_increment := TRUE;
  END IF;

  v_worker_id := NEW.worker_id;

  IF v_should_increment THEN
    UPDATE public.profiles
    SET verified_count = COALESCE(verified_count, 0) + 1
    WHERE id = v_worker_id;
  END IF;

  SELECT verified_count, COALESCE(level_admin_override, false) INTO v_new_verified, v_admin_override
  FROM public.profiles WHERE id = v_worker_id;

  SELECT ROUND(AVG(rating)::numeric, 2) INTO v_avg_rating
  FROM public.jobs
  WHERE worker_id = v_worker_id AND status = 'completed' AND rating IS NOT NULL;

  -- Atualizar level apenas se o admin NÃO definiu manualmente
  IF NOT v_admin_override THEN
    v_new_level := public.get_level_from_verified_count(COALESCE(v_new_verified, 0));
    UPDATE public.profiles
    SET level = v_new_level, rating = v_avg_rating
    WHERE id = v_worker_id;
  ELSE
    -- Só atualiza a média (rating), mantém o level definido pelo admin
    UPDATE public.profiles
    SET rating = v_avg_rating
    WHERE id = v_worker_id;
  END IF;

  RETURN NEW;
END;
$$;
