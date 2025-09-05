-- Script para criar usuários no Supabase
-- Execute este script no SQL Editor do painel do Supabase

-- Criar a tabela users se não existir
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir usuários (as senhas estão hasheadas com SHA256 + salt)
INSERT INTO users (name, email, password, is_active) VALUES 
('Lucas', 'lucas@agridom.com.br', '639368ffe08304eb07597d6038e66f433d0fdb5795bba6ae04e82286a78663fb', true),
('Ricardo', 'ricardo@agridom.com.br', '639368ffe08304eb07597d6038e66f433d0fdb5795bba6ae04e82286a78663fb', true)
ON CONFLICT (email) DO NOTHING;

-- Verificar se os usuários foram criados
SELECT id, name, email, is_active, created_at FROM users;