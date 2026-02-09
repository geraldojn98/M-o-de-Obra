-- ==========================================
-- MIGRAÇÃO: Sistema de Notificações Temporárias
-- Notificações são removidas automaticamente 3 dias após serem visualizadas
-- ==========================================

-- 1. Adicionar coluna read_at para registrar quando a notificação foi visualizada
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 2. Criar função para limpar notificações antigas (3 dias após visualização)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove notificações que foram lidas há mais de 3 dias
  DELETE FROM public.notifications
  WHERE read = true
    AND read_at IS NOT NULL
    AND read_at < NOW() - INTERVAL '3 days';
END;
$$;

-- 3. Criar função que atualiza read_at quando uma notificação é marcada como lida
CREATE OR REPLACE FUNCTION public.update_notification_read_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se a notificação está sendo marcada como lida (read = true) e ainda não tem read_at
  IF NEW.read = true AND OLD.read = false AND NEW.read_at IS NULL THEN
    NEW.read_at := NOW();
  END IF;
  
  -- Se a notificação está sendo desmarcada como lida, limpa o read_at
  IF NEW.read = false AND OLD.read = true THEN
    NEW.read_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Criar trigger para atualizar read_at automaticamente
DROP TRIGGER IF EXISTS trigger_update_notification_read_at ON public.notifications;
CREATE TRIGGER trigger_update_notification_read_at
  BEFORE UPDATE OF read ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_read_at();

-- 5. Criar função agendada (via pg_cron se disponível) ou pode ser chamada manualmente
-- Nota: pg_cron precisa ser habilitado no Supabase
-- Para executar manualmente, rode: SELECT public.cleanup_old_notifications();
-- Para agendar (se pg_cron estiver disponível):
-- SELECT cron.schedule('cleanup-old-notifications', '0 2 * * *', 'SELECT public.cleanup_old_notifications();');

-- 6. Comentários para documentação
COMMENT ON COLUMN public.notifications.read_at IS 'Data e hora em que a notificação foi visualizada. Notificações são removidas automaticamente 3 dias após esta data.';
COMMENT ON FUNCTION public.cleanup_old_notifications() IS 'Remove notificações que foram visualizadas há mais de 3 dias. Execute periodicamente (ex: diariamente via cron).';
