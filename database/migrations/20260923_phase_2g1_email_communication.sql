-- Kaizen CRM - Fase 2G.1: e-mail externo e log de comunicacao.
-- Migration incremental. Nao executar automaticamente em producao.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS communication_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel VARCHAR(40) NOT NULL,
  direction VARCHAR(20) NOT NULL,
  lead_id BIGINT UNSIGNED NULL,
  automation_id BIGINT UNSIGNED NULL,
  automation_run_id BIGINT UNSIGNED NULL,
  automation_step_id VARCHAR(100) NULL,
  idempotency_key VARCHAR(191) NULL,
  recipient VARCHAR(320) NOT NULL,
  subject VARCHAR(998) NULL,
  body_text LONGTEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  provider VARCHAR(80) NULL,
  provider_message_id VARCHAR(255) NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  error_code VARCHAR(100) NULL,
  error_message TEXT NULL,
  sent_at DATETIME NULL,
  failed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_communication_idempotency (idempotency_key),
  KEY idx_communication_lead (lead_id, created_at),
  KEY idx_communication_automation (automation_id, automation_run_id),
  CONSTRAINT fk_communication_lead FOREIGN KEY (lead_id) REFERENCES prospects(id) ON DELETE SET NULL,
  CONSTRAINT fk_communication_automation FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE SET NULL,
  CONSTRAINT fk_communication_run FOREIGN KEY (automation_run_id) REFERENCES automation_runs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS apply_phase_2g1_schema;
DELIMITER $$
CREATE PROCEDURE apply_phase_2g1_schema()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'integration_providers' AND COLUMN_NAME = 'secret_ciphertext') THEN
    ALTER TABLE integration_providers ADD COLUMN secret_ciphertext TEXT NULL AFTER configuration_metadata;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'integration_providers' AND COLUMN_NAME = 'secret_iv') THEN
    ALTER TABLE integration_providers ADD COLUMN secret_iv VARCHAR(64) NULL AFTER secret_ciphertext;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'integration_providers' AND COLUMN_NAME = 'secret_auth_tag') THEN
    ALTER TABLE integration_providers ADD COLUMN secret_auth_tag VARCHAR(64) NULL AFTER secret_iv;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'integration_providers' AND COLUMN_NAME = 'last_test_status') THEN
    ALTER TABLE integration_providers ADD COLUMN last_test_status VARCHAR(30) NULL AFTER last_tested_at;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'integration_providers' AND COLUMN_NAME = 'last_error') THEN
    ALTER TABLE integration_providers ADD COLUMN last_error VARCHAR(500) NULL AFTER last_test_status;
  END IF;
END$$
DELIMITER ;
CALL apply_phase_2g1_schema();
DROP PROCEDURE IF EXISTS apply_phase_2g1_schema;
