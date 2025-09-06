-- Script para corrigir a senha do usuário administrador
-- Execute este script no SQL Editor do Supabase

-- Atualizar a senha do usuário administrador para '123456'
UPDATE users 
SET password = '$2a$10$mrAU5h.8veg5mdnXE17CFOM5r7vRSCoLo648pI12EXABmqvZj1s9G'
WHERE email = 'agenciakaizendesign@gmail.com';

-- Verificar se o usuário foi atualizado
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
    created_at
FROM users 
WHERE email = 'agenciakaizendesign@gmail.com';