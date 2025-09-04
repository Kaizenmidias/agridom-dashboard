-- Script para atualizar permissões do usuário administrador
-- Garantir que o usuário admin@webdesign.com tenha acesso total ao sistema

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

-- Verificar se a atualização foi bem-sucedida
SELECT 
    id, 
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