-- Chat de suporte: usuários podem falar com o admin
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON public.support_messages(user_id);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Usuário vê e envia apenas na própria conversa (user_id = eu)
DROP POLICY IF EXISTS "Support messages user own" ON public.support_messages;
CREATE POLICY "Support messages user own"
  ON public.support_messages FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND sender_id = auth.uid());

-- Admin vê e envia em qualquer conversa (via service role ou policy is_admin)
DROP POLICY IF EXISTS "Support messages admin" ON public.support_messages;
CREATE POLICY "Support messages admin"
  ON public.support_messages FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
