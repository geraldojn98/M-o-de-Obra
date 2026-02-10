-- Remove a FK atual que impede a deleção do usuário em auth.users
ALTER TABLE category_suggestions
  DROP CONSTRAINT IF EXISTS category_suggestions_user_id_fkey;

-- Garante que user_id aceita NULL (necessário para ON DELETE SET NULL)
ALTER TABLE category_suggestions
  ALTER COLUMN user_id DROP NOT NULL;

-- Recria a FK com ON DELETE SET NULL: sugestão permanece, user_id vira NULL
ALTER TABLE category_suggestions
  ADD CONSTRAINT category_suggestions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
