-- Adicionar campos de permissões na tabela users
ALTER TABLE users 
ADD COLUMN can_access_dashboard BOOLEAN DEFAULT TRUE,
ADD COLUMN can_access_briefings BOOLEAN DEFAULT TRUE,
ADD COLUMN can_access_codes BOOLEAN DEFAULT TRUE,
ADD COLUMN can_access_projects BOOLEAN DEFAULT TRUE,
ADD COLUMN can_access_expenses BOOLEAN DEFAULT TRUE,
ADD COLUMN can_access_crm BOOLEAN DEFAULT TRUE,
ADD COLUMN can_access_users BOOLEAN DEFAULT FALSE;

-- Atualizar usuário Ricardo para ter acesso apenas a briefings e códigos
UPDATE users 
SET 
    can_access_dashboard = FALSE,
    can_access_briefings = TRUE,
    can_access_codes = TRUE,
    can_access_projects = FALSE,
    can_access_expenses = FALSE,
    can_access_crm = FALSE,
    can_access_users = FALSE
WHERE full_name = 'ricardo';

-- Garantir que o administrador tenha acesso a tudo
UPDATE users 
SET 
    can_access_dashboard = TRUE,
    can_access_briefings = TRUE,
    can_access_codes = TRUE,
    can_access_projects = TRUE,
    can_access_expenses = TRUE,
    can_access_crm = TRUE,
    can_access_users = TRUE
WHERE position = 'Administrador';