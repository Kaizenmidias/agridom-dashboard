-- Script para criar os usuários Lucas e Ricardo no Supabase
-- Execute este script no SQL Editor do Supabase

-- Primeiro, vamos verificar se os usuários já existem e removê-los se necessário
DELETE FROM users WHERE email IN ('agenciakaizendesign@gmail.com', 'ricardo@gmail.com');

-- Inserir usuário Lucas (Administrador)
INSERT INTO users (
    email,
    password,
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
) VALUES (
    'agenciakaizendesign@gmail.com',
    '$2b$10$KIbFWbnCRQCn/UB3T16PtecSeJzWaaxHKIA3Wy1k8Jiw4IgaNPpGS', -- Hash para 'Beatriz@2908'
    'Lucas',
    'admin',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    NOW(),
    NOW()
);

-- Inserir usuário Ricardo (Web Designer)
INSERT INTO users (
    email,
    password,
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
) VALUES (
    'ricardo@gmail.com',
    '$2b$10$6GeyFTYPOvc/4KAW7HeH0.q83rkl.LUkNJObm7llTJ/3.ylNwEFm2', -- Hash para '@FDPfeioso90'
    'Ricardo',
    'admin',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    NOW(),
    NOW()
);

-- Verificar se os usuários foram criados
SELECT id, email, name, role, is_active FROM users WHERE email IN ('agenciakaizendesign@gmail.com', 'ricardo@gmail.com');

-- Mostrar todas as permissões dos usuários criados
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
    can_access_users
FROM users 
WHERE email IN ('agenciakaizendesign@gmail.com', 'ricardo@gmail.com')
ORDER BY role DESC, name;