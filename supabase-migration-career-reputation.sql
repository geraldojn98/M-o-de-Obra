-- ==========================================
-- MIGRAÇÃO: Sistema de Carreira e Reputação
-- Execute após o schema base (supabase.sql) já estar aplicado.
-- ==========================================

-- PROFILES: nível, contador de serviços verificados e média de avaliações
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'bronze' CHECK (level IN ('bronze', 'silver', 'gold', 'diamond')),
  ADD COLUMN IF NOT EXISTS verified_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating NUMERIC;

-- JOBS: comentário da avaliação
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS review_comment TEXT;

-- Função para calcular o nível a partir do verified_count
CREATE OR REPLACE FUNCTION public.get_level_from_verified_count(v_count INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF v_count >= 50 THEN RETURN 'diamond';
  ELSIF v_count >= 25 THEN RETURN 'gold';
  ELSIF v_count >= 10 THEN RETURN 'silver';
  ELSE RETURN 'bronze';
  END IF;
END;
$$;

-- Função da trigger: atualiza level e verified_count do worker quando job recebe rating
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
BEGIN
  -- Só processar se worker_id existe e rating foi atualizado
  IF NEW.worker_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.rating IS NULL THEN RETURN NEW; END IF;

  -- Incrementar verified_count apenas quando rating passa a ser > 2 (e antes não contava)
  IF (OLD.rating IS NULL OR OLD.rating <= 2) AND NEW.rating > 2 THEN
    v_should_increment := TRUE;
  END IF;

  v_worker_id := NEW.worker_id;

  IF v_should_increment THEN
    UPDATE public.profiles
    SET verified_count = COALESCE(verified_count, 0) + 1
    WHERE id = v_worker_id;
  END IF;

  -- Recalcular level e avg_rating do worker
  SELECT verified_count INTO v_new_verified
  FROM public.profiles WHERE id = v_worker_id;

  v_new_level := public.get_level_from_verified_count(COALESCE(v_new_verified, 0));

  SELECT ROUND(AVG(rating)::numeric, 2) INTO v_avg_rating
  FROM public.jobs
  WHERE worker_id = v_worker_id AND status = 'completed' AND rating IS NOT NULL;

  UPDATE public.profiles
  SET level = v_new_level,
      rating = v_avg_rating
  WHERE id = v_worker_id;

  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir (para re-aplicação da migração)
DROP TRIGGER IF EXISTS update_worker_level_trigger ON public.jobs;

-- Criar trigger
CREATE TRIGGER update_worker_level_trigger
  AFTER UPDATE OF rating ON public.jobs
  FOR EACH ROW
  WHEN (
    OLD.rating IS DISTINCT FROM NEW.rating
    AND NEW.rating IS NOT NULL
    AND NEW.worker_id IS NOT NULL
  )
  EXECUTE FUNCTION public.update_worker_level_on_rating();

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.level IS 'Nível de carreira: bronze (0-9), silver (10-24), gold (25-49), diamond (50+) serviços verificados';
COMMENT ON COLUMN public.profiles.verified_count IS 'Quantidade de serviços com avaliação > 2 estrelas';
COMMENT ON COLUMN public.jobs.review_comment IS 'Comentário do cliente na avaliação do serviço';
