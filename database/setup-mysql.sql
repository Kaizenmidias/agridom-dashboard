-- Script de configuração do banco de dados MySQL para produção
-- Execute este script no phpMyAdmin ou MySQL Workbench

-- Criar banco de dados (substitua 'seu_banco_dados' pelo nome desejado)
CREATE DATABASE IF NOT EXISTS agri_dom_prod 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Usar o banco criado
USE agri_dom_prod;

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

-- Inserir configurações padrão
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('app_name', 'AgriDom Dashboard', 'Nome da aplicação'),
('app_version', '1.0.0', 'Versão da aplicação'),
('maintenance_mode', 'false', 'Modo de manutenção'),
('max_login_attempts', '5', 'Máximo de tentativas de login'),
('session_timeout', '24', 'Timeout da sessão em horas')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Criar usuário administrador padrão (senha: admin123)
-- IMPORTANTE: Altere a senha após o primeiro login!
INSERT INTO users (email, password, name, role) VALUES
('admin@agridom.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.F5e', 'Administrador', 'admin')
ON DUPLICATE KEY UPDATE 
    password = VALUES(password),
    name = VALUES(name),
    role = VALUES(role);

-- Criar índices adicionais para performance
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_password_reset_created_at ON password_reset_tokens(created_at);

-- Configurações de segurança
-- Limpar tokens expirados automaticamente (evento)
SET GLOBAL event_scheduler = ON;

DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_expired_tokens
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() OR used = TRUE;
    
    DELETE FROM sessions 
    WHERE expires_at < NOW();
END//
DELIMITER ;

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