-- Script para corrigir schema da tabela expenses
-- Converter user_id de integer para UUID

-- 1. Primeiro, vamos verificar a estrutura atual
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'expenses' AND column_name = 'user_id';

-- 2. Remover a foreign key constraint se existir
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_user_id_fkey;

-- 3. Adicionar nova coluna UUID temporária
ALTER TABLE expenses ADD COLUMN user_id_uuid UUID;

-- 4. Gerar UUIDs determinísticos baseados no user_id integer
-- Usando MD5 hash para criar UUIDs consistentes
UPDATE expenses 
SET user_id_uuid = (
    SUBSTRING(MD5(user_id::text) FROM 1 FOR 8) || '-' ||
    SUBSTRING(MD5(user_id::text) FROM 9 FOR 4) || '-' ||
    SUBSTRING(MD5(user_id::text) FROM 13 FOR 4) || '-' ||
    SUBSTRING(MD5(user_id::text) FROM 17 FOR 4) || '-' ||
    SUBSTRING(MD5(user_id::text) FROM 21 FOR 12)
)::UUID;

-- 5. Remover a coluna user_id antiga
ALTER TABLE expenses DROP COLUMN user_id;

-- 6. Renomear a nova coluna
ALTER TABLE expenses RENAME COLUMN user_id_uuid TO user_id;

-- 7. Adicionar constraint NOT NULL
ALTER TABLE expenses ALTER COLUMN user_id SET NOT NULL;

-- 8. Recriar índice
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);

-- 9. Verificar o resultado
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'expenses' AND column_name = 'user_id';

-- 10. Mostrar alguns registros para verificação
SELECT id, user_id, description, amount 
FROM expenses 
LIMIT 5;

-- IMPORTANTE: Execute este script manualmente no Supabase Dashboard
-- SQL Editor para aplicar as mudanças no schema.