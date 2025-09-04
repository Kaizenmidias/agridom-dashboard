-- Script para atualizar permissões de usuários administradores
-- Este script define todas as permissões de acesso como TRUE para usuários com cargo de administrador
-- Funciona independente do email, baseado apenas no cargo/role

-- Atualizar permissões para todos os usuários com cargo de administrador
UPDATE users 
SET 
    can_access_dashboard = TRUE,
    can_access_briefings = TRUE,
    can_access_codes = TRUE,
    can_access_projects = TRUE,
    can_access_expenses = TRUE,
    can_access_crm = TRUE,
    can_access_users = TRUE,
    is_active = TRUE
WHERE role IN ('admin', 'Administrador', 'administrador', 'Admin');

-- Verificar se a atualização foi bem-sucedida
SELECT 
    email,
    role,
    is_active,
    can_access_dashboard,
    can_access_briefings,
    can_access_codes,
    can_access_projects,
    can_access_expenses,
    can_access_crm,
    can_access_users
FROM users 
WHERE role IN ('admin', 'Administrador', 'administrador', 'Admin');