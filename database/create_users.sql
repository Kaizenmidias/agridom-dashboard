-- Script para criar os usuários Lucas e Ricardo
-- Execute este script no seu banco de dados PostgreSQL

-- Primeiro, vamos verificar se os usuários já existem e removê-los se necessário
DELETE FROM users WHERE email IN ('agenciakaizendesign@gmail.com', 'ricardorpc11@gmail.com');

-- Inserir usuário Lucas (Administrador)
INSERT INTO users (
    email,
    password_hash,
    full_name,
    position,
    bio,
    avatar_url,
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
    '$2b$10$vI8aWY7Lkz7Ij32tabq.uuCdqmI2.2Mp9B/EfNGtlxpeR.nSj.Oy2', -- Hash para 'Beatriz@2908'
    'Lucas',
    'Administrador',
    NULL,
    NULL,
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
    password_hash,
    full_name,
    position,
    bio,
    avatar_url,
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
    'ricardorpc11@gmail.com',
    '$2b$10$K7L/ByqjyqfW.rqOtd.lHOZz4laHiroMzBg9W/Uy9jo7S.Xh6q/Iq', -- Hash para '@FDPfeioso90'
    'Ricardo',
    'Web Designer',
    NULL,
    NULL,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    NOW(),
    NOW()
);

-- Verificar se os usuários foram criados
SELECT id, email, full_name, position, is_active FROM users WHERE email IN ('agenciakaizendesign@gmail.com', 'ricardorpc11@gmail.com');