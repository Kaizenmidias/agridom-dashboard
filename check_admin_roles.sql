-- Script para verificar todos os cargos/roles existentes no banco de dados
-- Este script ajuda a identificar as variações de cargo de administrador

-- Verificar todos os roles únicos na tabela users
SELECT DISTINCT role, COUNT(*) as quantidade
FROM users 
GROUP BY role
ORDER BY role;

-- Verificar usuários com possíveis cargos de administrador
SELECT 
    email,
    name,
    role,
    is_active,
    can_access_dashboard,
    can_access_users
FROM users 
WHERE role ILIKE '%admin%' OR role ILIKE '%administrador%'
ORDER BY role, email;

-- Verificar se existem usuários com todas as permissões (possíveis administradores)
SELECT 
    email,
    name,
    role,
    can_access_dashboard,
    can_access_briefings,
    can_access_codes,
    can_access_projects,
    can_access_expenses,
    can_access_crm,
    can_access_users
FROM users 
WHERE can_access_dashboard = TRUE 
    AND can_access_briefings = TRUE 
    AND can_access_codes = TRUE 
    AND can_access_projects = TRUE 
    AND can_access_expenses = TRUE 
    AND can_access_crm = TRUE 
    AND can_access_users = TRUE
ORDER BY role, email;