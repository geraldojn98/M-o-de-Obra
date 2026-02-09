-- ==========================================
-- MIGRAÇÃO: Correção da tabela punishment_appeals
-- Execute este script para corrigir as colunas da tabela de recursos de punição
-- ==========================================

-- Adicionar coluna appeal_text se não existir
ALTER TABLE public.punishment_appeals
  ADD COLUMN IF NOT EXISTS appeal_text TEXT;

-- Se a coluna 'content' existir e 'appeal_text' estiver vazia, copiar dados
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'punishment_appeals' 
    AND column_name = 'content'
  ) THEN
    -- Copiar dados de content para appeal_text onde appeal_text está NULL
    UPDATE public.punishment_appeals
    SET appeal_text = content
    WHERE appeal_text IS NULL AND content IS NOT NULL;
    
    -- Remover a coluna content antiga
    ALTER TABLE public.punishment_appeals DROP COLUMN IF EXISTS content;
  END IF;
END $$;

-- Tornar appeal_text NOT NULL após migração dos dados
DO $$
BEGIN
  -- Primeiro, garantir que não há NULLs
  UPDATE public.punishment_appeals
  SET appeal_text = 'Recurso sem descrição'
  WHERE appeal_text IS NULL;
  
  -- Depois tornar NOT NULL
  ALTER TABLE public.punishment_appeals
    ALTER COLUMN appeal_text SET NOT NULL;
EXCEPTION
  WHEN others THEN
    -- Se já for NOT NULL, ignora o erro
    NULL;
END $$;

-- Adicionar coluna admin_notes se não existir
ALTER TABLE public.punishment_appeals
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Se a coluna 'admin_response' existir, copiar dados para admin_notes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'punishment_appeals' 
    AND column_name = 'admin_response'
  ) THEN
    -- Copiar dados de admin_response para admin_notes onde admin_notes está NULL
    UPDATE public.punishment_appeals
    SET admin_notes = admin_response
    WHERE admin_notes IS NULL AND admin_response IS NOT NULL;
    
    -- Remover a coluna admin_response antiga
    ALTER TABLE public.punishment_appeals DROP COLUMN IF EXISTS admin_response;
  END IF;
END $$;

-- Adicionar coluna reviewed_at se não existir
ALTER TABLE public.punishment_appeals
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Garantir que job_id pode ser NULL (alguns recursos podem não estar vinculados a um job específico)
ALTER TABLE public.punishment_appeals
  ALTER COLUMN job_id DROP NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.punishment_appeals.appeal_text IS 'Texto do recurso de punição';
COMMENT ON COLUMN public.punishment_appeals.admin_notes IS 'Notas do administrador sobre o recurso';
COMMENT ON COLUMN public.punishment_appeals.reviewed_at IS 'Data/hora em que o recurso foi revisado pelo admin';
