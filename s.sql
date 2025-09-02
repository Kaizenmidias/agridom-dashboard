dashboarddashboarddashboarddashboarddashboarddashboard-- Script SQL para criar as tabelas do MariaDB
-- Execute este script no seu banco de dados MariaDB

-- Configurações do banco
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';
SET time_zone = '+00:00';

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de projetos
CREATE TABLE IF NOT EXISTS projects (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    client VARCHAR(255),
    project_type VARCHAR(100),
    status ENUM('active', 'completed', 'paused', 'cancelled') DEFAULT 'active',
    description TEXT,
    project_value DECIMAL(12, 2),
    paid_value DECIMAL(12, 2) DEFAULT 0,
    delivery_date DATE,
    user_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de despesas
CREATE TABLE IF NOT EXISTS expenses (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    date DATE NOT NULL,
    project_id CHAR(36),
    user_id CHAR(36) NOT NULL,
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de parcelas
CREATE TABLE IF NOT EXISTS parcels (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    area DECIMAL(10, 4) NOT NULL, -- em hectares
    location VARCHAR(255),
    soil_type VARCHAR(100),
    project_id CHAR(36),
    user_id CHAR(36) NOT NULL,
    coordinates TEXT, -- JSON com coordenadas geográficas
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de culturas
CREATE TABLE IF NOT EXISTS crops (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    variety VARCHAR(255),
    planting_date DATE NOT NULL,
    expected_harvest_date DATE,
    actual_harvest_date DATE,
    status ENUM('planned', 'planted', 'growing', 'harvested', 'failed') DEFAULT 'planned',
    parcel_id CHAR(36),
    user_id CHAR(36) NOT NULL,
    yield_expected DECIMAL(10, 2), -- produção esperada
    yield_actual DECIMAL(10, 2), -- produção real
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parcel_id) REFERENCES parcels(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices para melhor performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);

CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);

CREATE INDEX idx_parcels_user_id ON parcels(user_id);
CREATE INDEX idx_parcels_project_id ON parcels(project_id);

CREATE INDEX idx_crops_user_id ON crops(user_id);
CREATE INDEX idx_crops_parcel_id ON crops(parcel_id);
CREATE INDEX idx_crops_status ON crops(status);
CREATE INDEX idx_crops_planting_date ON crops(planting_date);

-- Inserir usuário de exemplo (senha: 123456)
INSERT IGNORE INTO users (id, email, password_hash, full_name, is_active) 
VALUES (
    UUID(),
    'admin@agridom.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9qK', -- senha: 123456
    'Administrador',
    true
);

-- Comentários das tabelas
ALTER TABLE users COMMENT = 'Tabela de usuários do sistema';
ALTER TABLE projects COMMENT = 'Tabela de projetos agrícolas';
ALTER TABLE expenses COMMENT = 'Tabela de despesas dos projetos';
ALTER TABLE parcels COMMENT = 'Tabela de parcelas de terra';
ALTER TABLE crops COMMENT = 'Tabela de culturas plantadas';

-- Verificar se as tabelas foram criadas
SHOW TABLES;

-- Verificar estrutura das tabelas
DESCRIBE users;
DESCRIBE projects;
DESCRIBE expenses;
DESCRIBE parcels;
DESCRIBE crops;