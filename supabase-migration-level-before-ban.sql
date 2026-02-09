-- ==========================================
-- MIGRAÇÃO: Nível antes do banimento (para restauração em recurso)
-- Execute após supabase-migration-admin-level-override.sql
-- ==========================================

-- Guardar o nível do profissional antes de ser banido (para opção de restaurar ao aprovar recurso)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level_before_ban TEXT CHECK (level_before_ban IS NULL OR level_before_ban IN ('bronze', 'silver', 'gold', 'diamond'));

COMMENT ON COLUMN public.profiles.level_before_ban IS 'Nível do profissional antes do último banimento; usado ao aprovar recurso para opção de restaurar nível.';
