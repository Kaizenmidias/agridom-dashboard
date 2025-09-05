-- Script para configurar os usuários finais do sistema
-- Execute este script no SQL Editor do Supabase

-- Primeiro, remover todos os usuários existentes
DELETE FROM users;

-- Inserir usuário administrador
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
    '$2a$10$QJmUZwhgz.NH7STC7NWCyOClPAGXcOw05aH3fgeaRLUY6dMCIB6fi',
    'Administrador',
    'admin',
    true,
    true, -- Dashboard
    true, -- Briefings
    true, -- Codes
    true, -- Projects
    true, -- Expenses
    true, -- CRM
    true, -- Users
    NOW(),
    NOW()
);

-- Inserir usuário web designer
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
    'ricardorpc11@gmail.com',
    '$2a$10$h4lC1.VBTwJ54MbylTakKOJw9yijhoKyON8A03.iywnLzHctpOKBC',
    'Ricardo',
    'designer',
    true,
    true, -- Dashboard
    true, -- Briefings
    true, -- Codes
    true, -- Projects
    false, -- Expenses (sem acesso)
    true, -- CRM
    false, -- Users (sem acesso)
    NOW(),
    NOW()
);

-- Verificar se os usuários foram criados corretamente
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
ORDER BY role DESC, name;

-- Contar total de usuários (deve ser 2)
SELECT COUNT(*) as total_users FROM users;