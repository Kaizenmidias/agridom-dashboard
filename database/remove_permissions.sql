-- Script para remover colunas de permissão da tabela users
-- Execute este script no seu banco de dados para remover o sistema de permissões

-- Remover colunas de permissão da tabela users
ALTER TABLE users DROP COLUMN IF EXISTS can_access_dashboard;
ALTER TABLE users DROP COLUMN IF EXISTS can_access_projects;
ALTER TABLE users DROP COLUMN IF EXISTS can_access_briefings;
ALTER TABLE users DROP COLUMN IF EXISTS can_access_codes;
ALTER TABLE users DROP COLUMN IF EXISTS can_access_expenses;
ALTER TABLE users DROP COLUMN IF EXISTS can_access_crm;
ALTER TABLE users DROP COLUMN IF EXISTS can_access_users;

-- Verificar estrutura da tabela após remoção
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;