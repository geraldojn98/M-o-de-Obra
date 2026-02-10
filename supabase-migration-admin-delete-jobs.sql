-- ==========================================
-- Permite que o admin apague serviços (jobs) e mensagens no painel.
-- Sem estas políticas, o DELETE retorna sucesso mas 0 linhas são afetadas (RLS bloqueia).
-- ==========================================

-- Admin pode deletar qualquer serviço
DROP POLICY IF EXISTS "Jobs Admin Delete" ON public.jobs;
CREATE POLICY "Jobs Admin Delete"
  ON public.jobs FOR DELETE
  USING (public.is_admin());

-- Admin pode deletar mensagens (para limpar antes de apagar o job)
DROP POLICY IF EXISTS "Messages Admin Delete" ON public.messages;
CREATE POLICY "Messages Admin Delete"
  ON public.messages FOR DELETE
  USING (public.is_admin());
