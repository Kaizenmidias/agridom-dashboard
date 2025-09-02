-- Script para adicionar campos cargo e biografia à tabela users
-- Execute este script no seu banco de dados MariaDB

USE dashboard;

-- Adicionar campo cargo (position/job title)
ALTER TABLE users ADD COLUMN position VARCHAR(255) NULL AFTER full_name;

-- Adicionar campo biografia
ALTER TABLE users ADD COLUMN bio TEXT NULL AFTER position;

-- Verificar a estrutura atualizada da tabela
DESCRIBE users;

SELECT 'Campos cargo e biografia adicionados com sucesso!' AS status;