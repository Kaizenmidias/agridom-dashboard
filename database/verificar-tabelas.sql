-- Script para verificar se as tabelas foram criadas corretamente
-- Execute este script no phpMyAdmin para diagnosticar problemas

-- 1. Verificar banco de dados atual
SELECT DATABASE() as banco_atual;

-- 2. Listar todas as tabelas no banco
SHOW TABLES;

-- 3. Verificar se a tabela users existe
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'users';

-- 4. Se a tabela users existir, mostrar sua estrutura
DESCRIBE users;

-- 5. Contar registros na tabela users (se existir)
SELECT COUNT(*) as total_usuarios FROM users;

-- 6. Verificar usuário admin (se a tabela existir)
SELECT id, email, name, role, created_at 
FROM users 
WHERE role = 'admin'
LIMIT 5;