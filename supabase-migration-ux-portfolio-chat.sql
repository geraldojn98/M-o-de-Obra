-- ==========================================
-- MIGRAÇÃO: UX – Portfólio do Profissional + Chat Multimídia + Storage
-- Execute após o schema base já estar aplicado.
-- ==========================================

-- 1. TABELA worker_portfolio (galeria do profissional)
CREATE TABLE IF NOT EXISTS public.worker_portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worker_portfolio_worker_id ON public.worker_portfolio(worker_id);

ALTER TABLE public.worker_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_portfolio_select_public" ON public.worker_portfolio;
CREATE POLICY "worker_portfolio_select_public"
  ON public.worker_portfolio FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "worker_portfolio_insert_own" ON public.worker_portfolio;
CREATE POLICY "worker_portfolio_insert_own"
  ON public.worker_portfolio FOR INSERT
  WITH CHECK (auth.uid() = worker_id);

DROP POLICY IF EXISTS "worker_portfolio_update_own" ON public.worker_portfolio;
CREATE POLICY "worker_portfolio_update_own"
  ON public.worker_portfolio FOR UPDATE
  USING (auth.uid() = worker_id)
  WITH CHECK (auth.uid() = worker_id);

DROP POLICY IF EXISTS "worker_portfolio_delete_own" ON public.worker_portfolio;
CREATE POLICY "worker_portfolio_delete_own"
  ON public.worker_portfolio FOR DELETE
  USING (auth.uid() = worker_id);

COMMENT ON TABLE public.worker_portfolio IS 'Fotos do portfólio dos profissionais (trabalhos realizados).';

-- 2. ATUALIZAR tabela messages (chat multimídia)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio'));
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url TEXT;

COMMENT ON COLUMN public.messages.message_type IS 'Tipo: text, image ou audio';
COMMENT ON COLUMN public.messages.media_url IS 'URL do arquivo no Storage (chat-images ou chat-audio)';

-- 3. STORAGE: Buckets chat-images e chat-audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('chat-images', 'chat-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('chat-audio', 'chat-audio', true, 10485760, ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);

-- 4. Políticas Storage chat-images: leitura pública; escrita apenas autenticados (path = job_id/user_id)
DROP POLICY IF EXISTS "chat_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "chat_images_insert_authenticated" ON storage.objects;
CREATE POLICY "chat_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

CREATE POLICY "chat_images_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "chat_images_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[2]);

-- 5. Políticas Storage chat-audio
DROP POLICY IF EXISTS "chat_audio_select_public" ON storage.objects;
DROP POLICY IF EXISTS "chat_audio_insert_authenticated" ON storage.objects;
CREATE POLICY "chat_audio_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-audio');

CREATE POLICY "chat_audio_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-audio'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "chat_audio_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-audio' AND auth.uid()::text = (storage.foldername(name))[2]);

-- 6. STORAGE: Bucket worker-portfolio (fotos do portfólio)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('worker-portfolio', 'worker-portfolio', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);

DROP POLICY IF EXISTS "worker_portfolio_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "worker_portfolio_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "worker_portfolio_storage_delete" ON storage.objects;
CREATE POLICY "worker_portfolio_storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'worker-portfolio');
CREATE POLICY "worker_portfolio_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'worker-portfolio' AND auth.role() = 'authenticated');
CREATE POLICY "worker_portfolio_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'worker-portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);
