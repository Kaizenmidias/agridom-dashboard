-- Script para corrigir schema do Supabase em produção
-- Executar no SQL Editor do Supabase Dashboard

-- 1. Corrigir projects.user_id para UUID
ALTER TABLE projects 
ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- 2. Garantir foreign key para usuários do Supabase Auth
ALTER TABLE projects 
ADD CONSTRAINT fk_projects_user 
FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- 3. Verificar se coluna amount existe na tabela expenses
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'amount') THEN
        -- Criar coluna amount se não existir
        ALTER TABLE expenses ADD COLUMN amount numeric;
        
        -- Se existe coluna 'value', copiar dados para 'amount'
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'value') THEN
            UPDATE expenses SET amount = value WHERE amount IS NULL;
        END IF;
    END IF;
END $$;

-- 4. Verificar se todas as colunas necessárias existem
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('projects', 'expenses')
ORDER BY table_name, ordinal_position;

-- 5. Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- 6. Verificar constraints
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('projects', 'expenses')
ORDER BY tc.table_name, tc.constraint_type;

-- Comentários:
-- Este script resolve os 3 problemas principais:
-- 1. Converte user_id de integer para UUID na tabela projects
-- 2. Cria coluna amount na tabela expenses (se não existir)
-- 3. Atualiza o cache do schema do Supabase
-- 4. Adiciona foreign key constraint para auth.users
-- 5. Inclui verificações para validar as mudanças