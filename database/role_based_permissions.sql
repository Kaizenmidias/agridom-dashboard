-- Sistema de Permissões Baseado em Cargos (Roles)
-- Este script implementa um sistema onde:
-- 1. Administradores têm acesso total automático
-- 2. Web Designers têm permissões específicas configuráveis
-- 3. Outros cargos podem ser adicionados conforme necessário

-- ============================================
-- 1. CRIAR TABELA DE DEFINIÇÕES DE CARGOS
-- ============================================

CREATE TABLE IF NOT EXISTS role_definitions (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    default_permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. INSERIR DEFINIÇÕES DE CARGOS PADRÃO
-- ============================================

-- Cargo de Administrador (acesso total)
INSERT INTO role_definitions (role_name, display_name, description, is_admin, default_permissions)
VALUES (
    'administrador',
    'Administrador',
    'Acesso total ao sistema com todas as permissões',
    TRUE,
    '{
        "can_access_dashboard": true,
        "can_access_projects": true,
        "can_access_briefings": true,
        "can_access_users": true,
        "can_access_reports": true,
        "can_access_settings": true,
        "can_manage_users": true,
        "can_manage_projects": true,
        "can_manage_briefings": true,
        "can_manage_reports": true,
        "can_manage_settings": true
    }'
) ON CONFLICT (role_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_admin = EXCLUDED.is_admin,
    default_permissions = EXCLUDED.default_permissions,
    updated_at = CURRENT_TIMESTAMP;

-- Cargo de Web Designer (permissões configuráveis)
INSERT INTO role_definitions (role_name, display_name, description, is_admin, default_permissions)
VALUES (
    'web_designer',
    'Web Designer',
    'Acesso limitado configurável pelo administrador',
    FALSE,
    '{
        "can_access_dashboard": true,
        "can_access_projects": true,
        "can_access_briefings": true,
        "can_access_users": false,
        "can_access_reports": false,
        "can_access_settings": false,
        "can_manage_users": false,
        "can_manage_projects": false,
        "can_manage_briefings": false,
        "can_manage_reports": false,
        "can_manage_settings": false
    }'
) ON CONFLICT (role_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_admin = EXCLUDED.is_admin,
    default_permissions = EXCLUDED.default_permissions,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- 3. CRIAR TABELA DE PERMISSÕES PERSONALIZADAS
-- ============================================

CREATE TABLE IF NOT EXISTS user_custom_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_name VARCHAR(100) NOT NULL,
    permission_value BOOLEAN NOT NULL,
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(user_id, permission_name)
);

-- ============================================
-- 4. FUNÇÃO PARA CALCULAR PERMISSÕES FINAIS
-- ============================================

CREATE OR REPLACE FUNCTION get_user_permissions(user_id_param INTEGER)
RETURNS JSONB AS $$
DECLARE
    user_role VARCHAR(50);
    role_def RECORD;
    final_permissions JSONB;
    custom_perm RECORD;
BEGIN
    -- Buscar o cargo do usuário
    SELECT role INTO user_role FROM users WHERE id = user_id_param;
    
    IF user_role IS NULL THEN
        RETURN '{}'::JSONB;
    END IF;
    
    -- Buscar definição do cargo
    SELECT * INTO role_def FROM role_definitions 
    WHERE role_name = LOWER(user_role) OR role_name = user_role;
    
    -- Se não encontrar definição específica, verificar se é admin
    IF role_def IS NULL THEN
        IF LOWER(user_role) IN ('admin', 'administrador', 'administrator') THEN
            -- Retornar permissões de admin
            RETURN '{
                "can_access_dashboard": true,
                "can_access_projects": true,
                "can_access_briefings": true,
                "can_access_users": true,
                "can_access_reports": true,
                "can_access_settings": true,
                "can_manage_users": true,
                "can_manage_projects": true,
                "can_manage_briefings": true,
                "can_manage_reports": true,
                "can_manage_settings": true
            }'::JSONB;
        ELSE
            -- Cargo desconhecido, permissões mínimas
            RETURN '{
                "can_access_dashboard": false,
                "can_access_projects": false,
                "can_access_briefings": false,
                "can_access_users": false,
                "can_access_reports": false,
                "can_access_settings": false,
                "can_manage_users": false,
                "can_manage_projects": false,
                "can_manage_briefings": false,
                "can_manage_reports": false,
                "can_manage_settings": false
            }'::JSONB;
        END IF;
    END IF;
    
    -- Começar com permissões padrão do cargo
    final_permissions := role_def.default_permissions;
    
    -- Se for admin, garantir todas as permissões
    IF role_def.is_admin THEN
        final_permissions := '{
            "can_access_dashboard": true,
            "can_access_projects": true,
            "can_access_briefings": true,
            "can_access_users": true,
            "can_access_reports": true,
            "can_access_settings": true,
            "can_manage_users": true,
            "can_manage_projects": true,
            "can_manage_briefings": true,
            "can_manage_reports": true,
            "can_manage_settings": true
        }'::JSONB;
    ELSE
        -- Aplicar permissões personalizadas para não-admins
        FOR custom_perm IN 
            SELECT permission_name, permission_value 
            FROM user_custom_permissions 
            WHERE user_id = user_id_param
        LOOP
            final_permissions := jsonb_set(
                final_permissions, 
                ARRAY[custom_perm.permission_name], 
                to_jsonb(custom_perm.permission_value)
            );
        END LOOP;
    END IF;
    
    RETURN final_permissions;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. ATUALIZAR TABELA DE USUÁRIOS
-- ============================================

-- Normalizar cargos existentes
UPDATE users SET role = 'administrador' 
WHERE LOWER(role) IN ('admin', 'administrador', 'administrator');

UPDATE users SET role = 'web_designer' 
WHERE LOWER(role) IN ('web designer', 'webdesigner', 'designer');

-- ============================================
-- 6. APLICAR PERMISSÕES BASEADAS EM CARGOS
-- ============================================

-- Atualizar permissões de todos os usuários baseado em seus cargos
UPDATE users SET 
    can_access_dashboard = (get_user_permissions(id)->>'can_access_dashboard')::BOOLEAN,
    can_access_projects = (get_user_permissions(id)->>'can_access_projects')::BOOLEAN,
    can_access_briefings = (get_user_permissions(id)->>'can_access_briefings')::BOOLEAN,
    can_access_users = (get_user_permissions(id)->>'can_access_users')::BOOLEAN,
    can_access_reports = (get_user_permissions(id)->>'can_access_reports')::BOOLEAN,
    can_access_settings = (get_user_permissions(id)->>'can_access_settings')::BOOLEAN;

-- ============================================
-- 7. CRIAR TRIGGER PARA AUTO-ATUALIZAÇÃO
-- ============================================

CREATE OR REPLACE FUNCTION update_user_permissions_on_role_change()
RETURNS TRIGGER AS $$
DECLARE
    new_permissions JSONB;
BEGIN
    -- Se o cargo mudou, atualizar permissões
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        new_permissions := get_user_permissions(NEW.id);
        
        NEW.can_access_dashboard := (new_permissions->>'can_access_dashboard')::BOOLEAN;
        NEW.can_access_projects := (new_permissions->>'can_access_projects')::BOOLEAN;
        NEW.can_access_briefings := (new_permissions->>'can_access_briefings')::BOOLEAN;
        NEW.can_access_users := (new_permissions->>'can_access_users')::BOOLEAN;
        NEW.can_access_reports := (new_permissions->>'can_access_reports')::BOOLEAN;
        NEW.can_access_settings := (new_permissions->>'can_access_settings')::BOOLEAN;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_update_permissions_on_role_change ON users;
CREATE TRIGGER trigger_update_permissions_on_role_change
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_permissions_on_role_change();

-- ============================================
-- 8. VERIFICAÇÕES E RELATÓRIOS
-- ============================================

-- Verificar usuários e suas permissões
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    rd.display_name as role_display,
    rd.is_admin,
    u.can_access_dashboard,
    u.can_access_projects,
    u.can_access_briefings,
    u.can_access_users,
    u.can_access_reports,
    u.can_access_settings
FROM users u
LEFT JOIN role_definitions rd ON (rd.role_name = u.role OR rd.role_name = LOWER(u.role))
ORDER BY u.role, u.name;

-- Verificar permissões personalizadas
SELECT 
    u.name,
    u.email,
    u.role,
    ucp.permission_name,
    ucp.permission_value,
    admin.name as granted_by_name,
    ucp.granted_at
FROM user_custom_permissions ucp
JOIN users u ON u.id = ucp.user_id
LEFT JOIN users admin ON admin.id = ucp.granted_by
ORDER BY u.name, ucp.permission_name;

COMMIT;