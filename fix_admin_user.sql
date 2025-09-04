-- Script para verificar e corrigir permissões do usuário administrador
-- Execute este script no painel do Supabase

-- 1. Primeiro, verificar o estado atual do usuário
SELECT 
    email,
    name,
    role,
    is_active,
    can_access_dashboard,
    can_access_briefings,
    can_access_codes,
    can_access_projects,
    can_access_expenses,
    can_access_crm,
    can_access_users,
    created_at,
    updated_at
FROM users 
WHERE email = 'admin@webdesign.com';

-- 2. Forçar atualização das permissões (método específico)
UPDATE users 
SET 
    can_access_dashboard = TRUE,
    can_access_briefings = TRUE,
    can_access_codes = TRUE,
    can_access_projects = TRUE,
    can_access_expenses = TRUE,
    can_access_crm = TRUE,
    can_access_users = TRUE,
    role = 'admin',
    is_active = TRUE,
    updated_at = NOW()
WHERE email = 'admin@webdesign.com';

-- 3. Verificar se a atualização funcionou
SELECT 
    email,
    name,
    role,
    is_active,
    can_access_dashboard,
    can_access_briefings,
    can_access_codes,
    can_access_projects,
    can_access_expenses,
    can_access_crm,
    can_access_users,
    updated_at
FROM users 
WHERE email = 'admin@webdesign.com';

-- 4. Verificar todos os usuários com role admin para comparação
SELECT 
    email,
    name,
    role,
    is_active,
    can_access_dashboard,
    can_access_users
FROM users 
WHERE role IN ('admin', 'Administrador', 'administrador', 'Admin')
ORDER BY email;