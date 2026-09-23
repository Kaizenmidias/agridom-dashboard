-- Kaizen CRM - Fase 2B: fundacao persistente da Automation Engine
-- Migration incremental e nao destrutiva para MySQL 8.4+.
-- Esta fase cria contratos e persistencia. Nenhuma automacao e executada por esta migration.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS automations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  status ENUM('draft', 'active', 'paused', 'archived') NOT NULL DEFAULT 'draft',
  trigger_type VARCHAR(100) NOT NULL,
  active_version_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_automations_owner_status (owner_user_id, status),
  KEY idx_automations_active_version (active_version_id),
  CONSTRAINT fk_automation_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_automation_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_automation_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  automation_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  status ENUM('draft', 'published', 'superseded') NOT NULL DEFAULT 'draft',
  definition JSON NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_automation_version_number (automation_id, version_number),
  KEY idx_automation_versions_status (automation_id, status),
  CONSTRAINT fk_automation_version_automation FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_automation_version_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_uuid CHAR(36) NOT NULL,
  idempotency_key VARCHAR(191) NULL,
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(191) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  payload JSON NOT NULL,
  correlation_id CHAR(36) NULL,
  causation_id CHAR(36) NULL,
  occurred_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_automation_event_uuid (event_uuid),
  UNIQUE KEY uq_automation_event_idempotency (idempotency_key),
  KEY idx_automation_events_type_time (event_type, occurred_at),
  KEY idx_automation_events_entity (entity_type, entity_id),
  KEY idx_automation_events_correlation (correlation_id),
  CONSTRAINT fk_automation_event_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  automation_id BIGINT UNSIGNED NOT NULL,
  automation_version_id BIGINT UNSIGNED NOT NULL,
  event_id BIGINT UNSIGNED NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(191) NOT NULL,
  status ENUM('queued', 'running', 'waiting', 'completed', 'failed', 'cancelled', 'skipped') NOT NULL DEFAULT 'queued',
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  current_step_key VARCHAR(100) NULL,
  error_code VARCHAR(100) NULL,
  error_message TEXT NULL,
  correlation_id CHAR(36) NULL,
  idempotency_key VARCHAR(191) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_automation_run_idempotency (idempotency_key),
  KEY idx_automation_runs_automation_time (automation_id, created_at),
  KEY idx_automation_runs_entity (entity_type, entity_id),
  KEY idx_automation_runs_status (status, created_at),
  KEY idx_automation_runs_version (automation_version_id),
  CONSTRAINT fk_automation_run_automation FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_automation_run_version FOREIGN KEY (automation_version_id) REFERENCES automation_versions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_automation_run_event FOREIGN KEY (event_id) REFERENCES automation_events(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_run_steps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  automation_run_id BIGINT UNSIGNED NOT NULL,
  step_key VARCHAR(100) NOT NULL,
  step_type VARCHAR(50) NOT NULL,
  status ENUM('queued', 'running', 'waiting', 'completed', 'failed', 'cancelled', 'skipped') NOT NULL DEFAULT 'queued',
  attempt INT UNSIGNED NOT NULL DEFAULT 0,
  input JSON NULL,
  output JSON NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  error_code VARCHAR(100) NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_automation_run_step (automation_run_id, step_key),
  KEY idx_automation_run_steps_status (status, updated_at),
  CONSTRAINT fk_automation_run_step_run FOREIGN KEY (automation_run_id) REFERENCES automation_runs(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  automation_run_id BIGINT UNSIGNED NOT NULL,
  run_step_id BIGINT UNSIGNED NULL,
  job_type VARCHAR(80) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  execute_at DATETIME NOT NULL,
  available_at DATETIME NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 3,
  locked_at DATETIME NULL,
  locked_by VARCHAR(100) NULL,
  last_error TEXT NULL,
  completed_at DATETIME NULL,
  failed_at DATETIME NULL,
  idempotency_key VARCHAR(191) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_automation_job_idempotency (idempotency_key),
  KEY idx_automation_jobs_available (status, execute_at, available_at),
  KEY idx_automation_jobs_lock (locked_at, status),
  KEY idx_automation_jobs_run (automation_run_id),
  CONSTRAINT fk_automation_job_run FOREIGN KEY (automation_run_id) REFERENCES automation_runs(id) ON DELETE RESTRICT,
  CONSTRAINT fk_automation_job_step FOREIGN KEY (run_step_id) REFERENCES automation_run_steps(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  automation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_automation_audit_automation_time (automation_id, created_at),
  KEY idx_automation_audit_action (action, created_at),
  CONSTRAINT fk_automation_audit_automation FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_automation_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A FK circular e adicionada depois que as duas tabelas dependentes existem.
DROP PROCEDURE IF EXISTS add_automation_active_version_fk;
DELIMITER $$
CREATE PROCEDURE add_automation_active_version_fk()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automations'
      AND CONSTRAINT_NAME = 'fk_automation_active_version'
  ) THEN
    ALTER TABLE automations
      ADD CONSTRAINT fk_automation_active_version
      FOREIGN KEY (active_version_id) REFERENCES automation_versions(id) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;
CALL add_automation_active_version_fk();
DROP PROCEDURE add_automation_active_version_fk;
