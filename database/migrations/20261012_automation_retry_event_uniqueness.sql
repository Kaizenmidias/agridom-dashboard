-- Permite retries manuais preservando a deduplicacao de eventos normais.
-- Nao executa retries, nao altera dados existentes e e reversivel.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_automation_retry_event_uniqueness;
DELIMITER $$
CREATE PROCEDURE apply_automation_retry_event_uniqueness()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automation_runs'
      AND COLUMN_NAME = 'execution_kind'
  ) THEN
    ALTER TABLE automation_runs
      ADD COLUMN execution_kind ENUM('event', 'manual_retry') NOT NULL DEFAULT 'event' AFTER idempotency_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automation_runs'
      AND INDEX_NAME = 'uq_automation_run_event_automation_version_kind'
  ) THEN
    ALTER TABLE automation_runs DROP INDEX uq_automation_run_event_automation_version_kind;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automation_runs'
      AND COLUMN_NAME = 'event_dedupe_key'
  ) THEN
    ALTER TABLE automation_runs
      ADD COLUMN event_dedupe_key VARCHAR(191)
      GENERATED ALWAYS AS (
        IF(execution_kind = 'event', CONCAT(event_id, ':', automation_id, ':', automation_version_id), NULL)
      ) STORED AFTER execution_kind;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automation_runs'
      AND INDEX_NAME = 'uq_automation_run_event_dedupe_key'
  ) THEN
    ALTER TABLE automation_runs
      ADD UNIQUE KEY uq_automation_run_event_dedupe_key (event_dedupe_key);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automation_runs'
      AND INDEX_NAME = 'uq_automation_run_event_automation_version'
  ) THEN
    ALTER TABLE automation_runs DROP INDEX uq_automation_run_event_automation_version;
  END IF;
END$$
DELIMITER ;
CALL apply_automation_retry_event_uniqueness();
DROP PROCEDURE apply_automation_retry_event_uniqueness;

-- Rollback manual, somente após arquivar retries manuais:
-- ALTER TABLE automation_runs DROP INDEX uq_automation_run_event_dedupe_key;
-- ALTER TABLE automation_runs DROP COLUMN event_dedupe_key;
-- ALTER TABLE automation_runs DROP COLUMN execution_kind;
-- ALTER TABLE automation_runs
--   ADD UNIQUE KEY uq_automation_run_event_automation_version
--   (event_id, automation_id, automation_version_id);
