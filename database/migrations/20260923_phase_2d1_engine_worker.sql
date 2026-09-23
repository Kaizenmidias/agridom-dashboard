-- Kaizen CRM - Fase 2D.1: estado persistente do matcher e worker
-- Incremental, nao destrutiva e compativel com MySQL 8.4.
-- Esta migration nao inicia processo, nao executa actions e nao altera dados comerciais.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_phase_2d1_schema;
DELIMITER $$
CREATE PROCEDURE apply_phase_2d1_schema()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND COLUMN_NAME = 'engine_status'
  ) THEN
    ALTER TABLE automation_events ADD COLUMN engine_status ENUM('pending', 'processing', 'processed', 'failed') NOT NULL DEFAULT 'pending' AFTER causation_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND COLUMN_NAME = 'engine_locked_at'
  ) THEN
    ALTER TABLE automation_events ADD COLUMN engine_locked_at DATETIME NULL AFTER engine_status;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND COLUMN_NAME = 'engine_locked_by'
  ) THEN
    ALTER TABLE automation_events ADD COLUMN engine_locked_by VARCHAR(100) NULL AFTER engine_locked_at;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND COLUMN_NAME = 'engine_attempts'
  ) THEN
    ALTER TABLE automation_events ADD COLUMN engine_attempts INT UNSIGNED NOT NULL DEFAULT 0 AFTER engine_locked_by;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND COLUMN_NAME = 'engine_last_error'
  ) THEN
    ALTER TABLE automation_events ADD COLUMN engine_last_error TEXT NULL AFTER engine_attempts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND COLUMN_NAME = 'engine_processed_at'
  ) THEN
    ALTER TABLE automation_events ADD COLUMN engine_processed_at DATETIME NULL AFTER engine_last_error;
  END IF;
END$$
DELIMITER ;
CALL apply_phase_2d1_schema();
DROP PROCEDURE apply_phase_2d1_schema;

DROP PROCEDURE IF EXISTS add_phase_2d1_event_indexes;
DELIMITER $$
CREATE PROCEDURE add_phase_2d1_event_indexes()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_runs' AND INDEX_NAME = 'uq_automation_run_event_automation_version'
  ) THEN
    ALTER TABLE automation_runs ADD UNIQUE KEY uq_automation_run_event_automation_version (event_id, automation_id, automation_version_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND INDEX_NAME = 'idx_automation_events_engine_pending'
  ) THEN
    ALTER TABLE automation_events ADD KEY idx_automation_events_engine_pending (engine_status, occurred_at, id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND INDEX_NAME = 'idx_automation_events_engine_lock'
  ) THEN
    ALTER TABLE automation_events ADD KEY idx_automation_events_engine_lock (engine_status, engine_locked_at);
  END IF;
END$$
DELIMITER ;
CALL add_phase_2d1_event_indexes();
DROP PROCEDURE add_phase_2d1_event_indexes;
