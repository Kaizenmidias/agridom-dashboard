-- Script para criar usuário de teste se não existir
-- Execute este script no Supabase SQL Editor

-- Verificar se existe usuário com id = 1
SELECT * FROM users WHERE id = 1;

-- Se não existir, criar usuário de teste
INSERT INTO users (id, name, email, password, created_at, updated_at)
VALUES (1, 'Usuário Teste', 'teste@agridom.com', '$2b$10$dummy.hash.for.test.user', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Verificar se foi criado
SELECT * FROM users WHERE id = 1;

-- Verificar constraints da tabela codes
SELECT 
    column_name,
    is_nullable,
    data_type,
    character_maximum_length,
    column_default
FROM information_schema.columns 
WHERE table_name = 'codes' 
ORDER BY ordinal_position;