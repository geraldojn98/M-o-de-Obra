-- ==========================================
-- Corrige a FK de punishment_appeals.job_id para permitir DELETE CASCADE
-- Quando um job é deletado, os appeals relacionados também são deletados automaticamente.
-- ==========================================

-- Remove a constraint atual (pode ter nomes diferentes dependendo de quando foi criada)
ALTER TABLE public.punishment_appeals
  DROP CONSTRAINT IF EXISTS punishment_appeals_job_id_fkey;

ALTER TABLE public.punishment_appeals
  DROP CONSTRAINT IF EXISTS punishment_appeals_job_id_jobs_id_fk;

-- Recria a FK com ON DELETE CASCADE
ALTER TABLE public.punishment_appeals
  ADD CONSTRAINT punishment_appeals_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
