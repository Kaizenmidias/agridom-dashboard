-- Script para adicionar campos de recuperação de senha à tabela users
-- Execute este script no seu banco de dados MariaDB

USE dashboard;

-- Adicionar campo para token de recuperação
ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL AFTER password_hash;

-- Adicionar campo para expiração do token
ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP NULL AFTER reset_token;

-- Verificar a estrutura atualizada da tabela
DESCRIBE users;

SELECT 'Campos de recuperação de senha adicionados com sucesso!' AS status;