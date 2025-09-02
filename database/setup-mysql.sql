-- Script de configuração do banco de dados MySQL para cPanel
-- Execute este script no phpMyAdmin após selecionar seu banco de dados
-- IMPORTANTE: Selecione seu banco de dados antes de executar este script

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Tabela de tokens de recuperação de senha
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_email (email),
    INDEX idx_expires (expires_at)
);

-- Tabela de sessões (se necessário)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT,
    data TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expires (expires_at)
);

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (setting_key)
);

-- Tabela de projetos
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client VARCHAR(255) NOT NULL,
    type ENUM('website', 'ecommerce', 'landing_page', 'app', 'branding', 'other') DEFAULT 'website',
    status ENUM('active', 'completed', 'paused', 'cancelled') DEFAULT 'active',
    description TEXT,
    value DECIMAL(10, 2),
    paid_value DECIMAL(10, 2) DEFAULT 0,
    delivery_date DATE,
    completion_date DATE,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_type (type),
    INDEX idx_delivery_date (delivery_date)
);

-- Tabela de despesas
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    date DATE NOT NULL,
    billing_type ENUM('one_time', 'recurring') DEFAULT 'one_time',
    recurrence ENUM('monthly', 'quarterly', 'yearly') NULL,
    project_id INT,
    user_id INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_project_id (project_id),
    INDEX idx_date (date),
    INDEX idx_category (category),
    INDEX idx_billing_type (billing_type)
);

-- Tabela de códigos
CREATE TABLE IF NOT EXISTS codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type)
);

-- Tabela de briefings
CREATE TABLE IF NOT EXISTS briefings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    client VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    deadline DATE,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_deadline (deadline)
);

-- Inserir configurações padrão
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('app_name', 'WebDesign Dashboard', 'Nome da aplicação'),
('app_version', '1.0.0', 'Versão da aplicação'),
('maintenance_mode', 'false', 'Modo de manutenção'),
('max_login_attempts', '5', 'Máximo de tentativas de login'),
('session_timeout', '24', 'Timeout da sessão em horas')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Adicionar colunas de permissão na tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS can_access_dashboard BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS can_access_briefings BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS can_access_codes BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS can_access_projects BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS can_access_expenses BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS can_access_crm BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS can_access_users BOOLEAN DEFAULT FALSE;

-- Criar usuário administrador padrão (senha: admin123)
-- IMPORTANTE: Altere a senha após o primeiro login!
INSERT INTO users (email, password, name, role, can_access_dashboard, can_access_briefings, can_access_codes, can_access_projects, can_access_expenses, can_access_crm, can_access_users) VALUES
('admin@webdesign.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.F5e', 'Administrador', 'admin', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
ON DUPLICATE KEY UPDATE 
    password = VALUES(password),
    name = VALUES(name),
    role = VALUES(role),
    can_access_dashboard = VALUES(can_access_dashboard),
    can_access_briefings = VALUES(can_access_briefings),
    can_access_codes = VALUES(can_access_codes),
    can_access_projects = VALUES(can_access_projects),
    can_access_expenses = VALUES(can_access_expenses),
    can_access_crm = VALUES(can_access_crm),
    can_access_users = VALUES(can_access_users);

-- Inserir dados de exemplo
INSERT INTO codes (type, content, user_id) VALUES
('HTML', '<div class="container">\n  <h1>Exemplo HTML</h1>\n  <p>Este é um exemplo de código HTML.</p>\n</div>', 1),
('CSS', '.container {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 20px;\n}\n\nh1 {\n  color: #333;\n  font-size: 2rem;\n}', 1),
('JavaScript', 'function exemplo() {\n  console.log("Olá, mundo!");\n  return "Função executada com sucesso";\n}\n\nexemplo();', 1)
ON DUPLICATE KEY UPDATE content = VALUES(content);

-- Criar índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_created_at ON password_reset_tokens(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_codes_created_at ON codes(created_at);
CREATE INDEX IF NOT EXISTS idx_briefings_created_at ON briefings(created_at);

-- Configurações de segurança
-- NOTA: Limpeza automática de tokens removida (requer privilégios SUPER)
-- Recomenda-se criar um script de limpeza manual ou via cron job

-- Mostrar informações do banco criado
SELECT 
    'Banco de dados configurado com sucesso!' as status,
    DATABASE() as banco_atual,
    COUNT(*) as total_tabelas
FROM information_schema.tables 
WHERE table_schema = DATABASE();

-- Mostrar tabelas criadas
SHOW TABLES;

-- Verificar usuário admin criado
SELECT id, email, name, role, created_at 
FROM users 
WHERE role = 'admin';