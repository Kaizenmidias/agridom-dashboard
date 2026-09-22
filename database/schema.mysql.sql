-- Kaizen CRM - Schema MySQL de producao
-- MySQL 8+ / MariaDB 10.6+

CREATE DATABASE IF NOT EXISTS kaizen_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kaizen_crm;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  avatar_url TEXT NULL,
  bio TEXT NULL,
  position VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  can_access_dashboard TINYINT(1) NOT NULL DEFAULT 1,
  can_access_briefings TINYINT(1) NOT NULL DEFAULT 1,
  can_access_codes TINYINT(1) NOT NULL DEFAULT 1,
  can_access_projects TINYINT(1) NOT NULL DEFAULT 1,
  can_access_expenses TINYINT(1) NOT NULL DEFAULT 1,
  can_access_crm TINYINT(1) NOT NULL DEFAULT 1,
  can_access_users TINYINT(1) NOT NULL DEFAULT 0,
  reset_token VARCHAR(128) NULL,
  reset_token_expiry DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  client VARCHAR(255) NULL,
  client_name VARCHAR(255) NULL,
  project_type VARCHAR(100) NOT NULL DEFAULT 'website',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  description TEXT NULL,
  project_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date DATE NULL,
  end_date DATE NULL,
  delivery_date DATE NULL,
  completion_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_projects_user_status (user_id, status),
  KEY idx_projects_delivery_date (delivery_date),
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  value DECIMAL(12,2) GENERATED ALWAYS AS (amount) STORED,
  category VARCHAR(100) NULL,
  date DATE NOT NULL,
  billing_type ENUM('unica', 'semanal', 'mensal', 'anual') NOT NULL DEFAULT 'unica',
  is_recurring TINYINT(1) NOT NULL DEFAULT 0,
  recurring_day_of_week TINYINT NULL,
  recurring_end_date DATE NULL,
  original_expense_id BIGINT UNSIGNED NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_user_date (user_id, date),
  KEY idx_expenses_project (project_id),
  CONSTRAINT fk_expenses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_expenses_original FOREIGN KEY (original_expense_id) REFERENCES expenses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_access (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  wordpress_url TEXT NULL,
  wordpress_login VARCHAR(255) NULL,
  wordpress_password TEXT NULL,
  domain_url TEXT NULL,
  domain_login VARCHAR(255) NULL,
  domain_password TEXT NULL,
  hosting_url TEXT NULL,
  hosting_login VARCHAR(255) NULL,
  hosting_password TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_company_access_user (user_id),
  CONSTRAINT fk_company_access_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS briefings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  client VARCHAR(255) NULL,
  client_name VARCHAR(255) NULL,
  subject VARCHAR(255) NULL,
  project_type VARCHAR(100) NULL,
  budget DECIMAL(12,2) NULL,
  description TEXT NULL,
  content LONGTEXT NULL,
  fields JSON NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  deadline DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_briefings_user_status (user_id, status),
  CONSTRAINT fk_briefings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  name VARCHAR(255) NULL,
  language VARCHAR(50) NOT NULL,
  code_content LONGTEXT NOT NULL,
  content LONGTEXT GENERATED ALWAYS AS (code_content) STORED,
  type VARCHAR(50) GENERATED ALWAYS AS (language) STORED,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_codes_user_language (user_id, language),
  FULLTEXT KEY ft_codes_search (title, name, description, code_content),
  CONSTRAINT fk_codes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parcels (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  area DECIMAL(12,2) NULL,
  soil_type VARCHAR(100) NULL,
  coordinates JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_parcels_project (project_id),
  CONSTRAINT fk_parcels_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crops (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parcel_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  variety VARCHAR(255) NULL,
  planting_date DATE NULL,
  expected_harvest_date DATE NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_crops_parcel (parcel_id),
  CONSTRAINT fk_crops_parcel FOREIGN KEY (parcel_id) REFERENCES parcels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(191) NOT NULL,
  setting_value JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_system_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT UNSIGNED NULL,
  business_name VARCHAR(255) NOT NULL,
  normalized_business_name VARCHAR(255) NULL,
  category VARCHAR(150) NULL,
  address TEXT NULL,
  city VARCHAR(150) NULL,
  state VARCHAR(50) NULL,
  phone VARCHAR(50) NULL,
  normalized_phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  website TEXT NULL,
  normalized_website VARCHAR(255) NULL,
  google_maps_url TEXT NULL,
  google_rating DECIMAL(3,2) NULL,
  google_reviews INT NOT NULL DEFAULT 0,
  instagram TEXT NULL,
  facebook TEXT NULL,
  website_exists TINYINT(1) NOT NULL DEFAULT 0,
  pagespeed_mobile INT NULL,
  pagespeed_desktop INT NULL,
  seo_score INT NULL,
  lead_score INT NOT NULL DEFAULT 0,
  website_quality VARCHAR(100) NULL,
  problems_found JSON NULL,
  approach_suggestion TEXT NULL,
  diagnostic_summary TEXT NULL,
  analysis_report JSON NULL,
  last_contact_date DATETIME NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Novo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prospects_owner_status (owner_user_id, status),
  KEY idx_prospects_city_state (city, state),
  CONSTRAINT fk_prospects_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospect_contact_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prospect_id BIGINT UNSIGNED NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  channel VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NULL,
  message TEXT NOT NULL,
  recipient VARCHAR(255) NULL,
  delivery_status VARCHAR(100) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prospect_history_prospect (prospect_id),
  KEY idx_prospect_history_owner (owner_user_id),
  CONSTRAINT fk_history_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL,
  CONSTRAINT fk_history_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospecting_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT UNSIGNED NULL,
  whatsapp_template TEXT NOT NULL,
  email_subject VARCHAR(255) NOT NULL,
  email_body_html LONGTEXT NOT NULL,
  sender_name VARCHAR(255) NOT NULL DEFAULT 'Kaizen',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prospecting_settings_owner (owner_user_id),
  CONSTRAINT fk_prospecting_settings_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS integration_providers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(80) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'not_configured',
  configuration_metadata JSON NULL,
  last_tested_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_integration_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cnae_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  formatted_code VARCHAR(30) NOT NULL,
  description VARCHAR(255) NOT NULL,
  section VARCHAR(150) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cnae_code (code),
  FULLTEXT KEY ft_cnae_search (code, formatted_code, description, section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospecting_jobs (
  id CHAR(36) NOT NULL,
  source VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  search_parameters JSON NULL,
  requested_quantity INT NOT NULL DEFAULT 20,
  processed_count INT NOT NULL DEFAULT 0,
  found_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  valid_count INT NOT NULL DEFAULT 0,
  invalid_count INT NOT NULL DEFAULT 0,
  external_run_id VARCHAR(255) NULL,
  external_dataset_id VARCHAR(255) NULL,
  integration_provider VARCHAR(80) NULL,
  credits_estimated DECIMAL(12,4) NULL,
  credits_consumed DECIMAL(12,4) NULL,
  created_by BIGINT UNSIGNED NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  failed_at DATETIME NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prospecting_jobs_user_status (created_by, status),
  CONSTRAINT fk_jobs_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospecting_results (
  id CHAR(36) NOT NULL,
  job_id CHAR(36) NOT NULL,
  source VARCHAR(50) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  category VARCHAR(150) NULL,
  address TEXT NULL,
  city VARCHAR(150) NULL,
  state VARCHAR(50) NULL,
  phone VARCHAR(50) NULL,
  normalized_phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  website TEXT NULL,
  normalized_website_domain VARCHAR(255) NULL,
  instagram_url TEXT NULL,
  cnpj VARCHAR(30) NULL,
  rating DECIMAL(3,2) NULL,
  review_count INT NULL,
  whatsapp_status VARCHAR(50) NULL,
  duplicate_status VARCHAR(50) NOT NULL DEFAULT 'new',
  raw_payload JSON NULL,
  imported_to_leads_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_results_job (job_id),
  KEY idx_results_duplicate (duplicate_status),
  CONSTRAINT fk_results_job FOREIGN KEY (job_id) REFERENCES prospecting_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospecting_job_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id CHAR(36) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_events_job (job_id, created_at),
  CONSTRAINT fk_events_job FOREIGN KEY (job_id) REFERENCES prospecting_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_validation_cache (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  normalized_phone VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  metadata JSON NULL,
  validated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_whatsapp_phone (normalized_phone),
  KEY idx_whatsapp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO integration_providers (provider, display_name, status, configuration_metadata)
VALUES
  ('apify', 'Apify', 'not_configured', JSON_OBJECT()),
  ('casa_dos_dados', 'Casa dos Dados', 'not_configured', JSON_OBJECT()),
  ('whatsapp_validator', 'Evolution API', 'not_configured', JSON_OBJECT()),
  ('smtp', 'SMTP', 'not_configured', JSON_OBJECT())
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

INSERT INTO cnae_codes (code, formatted_code, description, section)
VALUES
  ('7311400', '7311-4/00', 'Agencias de publicidade', 'Comunicacao'),
  ('6920601', '6920-6/01', 'Atividades de contabilidade', 'Atividades profissionais'),
  ('8630503', '8630-5/03', 'Atividade medica ambulatorial restrita a consultas', 'Saude humana'),
  ('6911701', '6911-7/01', 'Servicos advocaticios', 'Atividades profissionais'),
  ('6821801', '6821-8/01', 'Corretagem na compra e venda e avaliacao de imoveis', 'Atividades imobiliarias')
ON DUPLICATE KEY UPDATE description = VALUES(description), section = VALUES(section);

-- Usuario administrador inicial.
-- Email: agenciakaizendesign@gmail.com
-- Senha inicial: 123456
-- Troque a senha imediatamente no primeiro acesso.
INSERT INTO users (
  email, password, name, role, is_active,
  can_access_dashboard, can_access_briefings, can_access_codes,
  can_access_projects, can_access_expenses, can_access_crm, can_access_users
) VALUES (
  'agenciakaizendesign@gmail.com',
  '$2a$10$5Izk5NgVlCfpkhU5w6awTOFR8F3Yjws80Ar71jmN2xl798IX7GYga',
  'Administrador',
  'admin',
  1,
  1, 1, 1, 1, 1, 1, 1
) ON DUPLICATE KEY UPDATE role = 'admin', is_active = 1, can_access_users = 1;
