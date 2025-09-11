-- Script simplificado para corrigir schema do Supabase
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Primeiro, verificar o tipo atual da coluna user_id
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'user_id';

-- 2. Corrigir projects.user_id para UUID (se ainda for integer)
ALTER TABLE projects 
ALTER COLUMN user_id TYPE uuid USING user_id::text::uuid;

-- 3. Remover constraint existente se houver problema
ALTER TABLE projects 
DROP CONSTRAINT IF EXISTS fk_projects_user;

-- 4. Recriar foreign key para auth.users
ALTER TABLE projects 
ADD CONSTRAINT fk_projects_user 
FORIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. Verificar o resultado
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'user_id';

-- 6. Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- 7. Verificar constraints
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'projects' AND kcu.column_name = 'user_id';