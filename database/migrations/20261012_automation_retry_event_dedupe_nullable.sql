-- Corrige a deduplicacao de automation_runs sem coluna gerada.
-- Executar depois de 20261012_automation_retry_event_uniqueness.sql.
-- Nao desativa FKs, nao remove dados e aborta em qualquer erro.
-- DDL do MySQL pode realizar commits implicitos; a constraint antiga permanece
-- ate todas as validacoes e a nova constraint estarem concluidas.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_automation_retry_event_dedupe_nullable;
DELIMITER $$
CREATE PROCEDURE apply_automation_retry_event_dedupe_nullable()
BEGIN
  DECLARE duplicate_count BIGINT DEFAULT 0;
  DECLARE column_count BIGINT DEFAULT 0;
  DECLARE column_type VARCHAR(64) DEFAULT NULL;
  DECLARE column_length BIGINT DEFAULT NULL;
  DECLARE column_nullable VARCHAR(3) DEFAULT NULL;
  DECLARE column_extra VARCHAR(64) DEFAULT NULL;
  DECLARE column_generation TEXT DEFAULT NULL;
  DECLARE invalid_count BIGINT DEFAULT 0;
  DECLARE dedupe_index_count BIGINT DEFAULT 0;
  DECLARE dedupe_index_non_unique BIGINT DEFAULT NULL;
  DECLARE dedupe_index_column_count BIGINT DEFAULT 0;
  DECLARE dedupe_index_max_seq BIGINT DEFAULT NULL;
  DECLARE dedupe_index_column VARCHAR(64) DEFAULT NULL;
  DECLARE dedupe_index_sub_part BIGINT DEFAULT NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    RESIGNAL;
  END;

  SELECT COUNT(*), MAX(DATA_TYPE), MAX(CHARACTER_MAXIMUM_LENGTH), MAX(IS_NULLABLE), MAX(EXTRA), MAX(GENERATION_EXPRESSION)
  INTO column_count, column_type, column_length, column_nullable, column_extra, column_generation
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'automation_runs'
    AND COLUMN_NAME = 'event_dedupe_key';

  IF column_count > 0 AND (
    column_type <> 'varchar'
    OR column_length <> 191
    OR column_nullable <> 'YES'
    OR COALESCE(column_extra, '') REGEXP '(^| )GENERATED'
    OR COALESCE(column_generation, '') <> ''
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'event_dedupe_key existe com definicao incompativel; nenhuma alteracao automatica foi feita';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automation_runs'
      AND COLUMN_NAME = 'execution_kind'
  ) THEN
    ALTER TABLE automation_runs
      ADD COLUMN execution_kind ENUM('event', 'manual_retry') NOT NULL DEFAULT 'event' AFTER idempotency_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automation_runs'
      AND INDEX_NAME = 'idx_automation_runs_event_id'
  ) THEN
    ALTER TABLE automation_runs ADD KEY idx_automation_runs_event_id (event_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automation_runs'
      AND COLUMN_NAME = 'event_dedupe_key'
  ) THEN
    ALTER TABLE automation_runs
      ADD COLUMN event_dedupe_key VARCHAR(191) NULL AFTER execution_kind;
  END IF;

  UPDATE automation_runs
  SET event_dedupe_key = CONCAT(event_id, ':', automation_id, ':', automation_version_id)
  WHERE execution_kind = 'event'
    AND event_id IS NOT NULL
    AND event_dedupe_key IS NULL;

  SELECT COUNT(*) INTO invalid_count
  FROM automation_runs
  WHERE execution_kind = 'event'
    AND event_id IS NOT NULL
    AND event_dedupe_key IS NULL;

  IF invalid_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'eventos normais com event_id nao possuem event_dedupe_key';
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM automation_runs
  WHERE execution_kind = 'event'
    AND event_id IS NOT NULL
    AND event_dedupe_key <> CONCAT(event_id, ':', automation_id, ':', automation_version_id);

  IF invalid_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'event_dedupe_key divergente dos identificadores da execucao';
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM automation_runs
  WHERE execution_kind = 'manual_retry'
    AND event_dedupe_key IS NOT NULL;

  IF invalid_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'retry manual possui event_dedupe_key indevida';
  END IF;

  SELECT
    COUNT(*),
    MAX(NON_UNIQUE),
    COUNT(COLUMN_NAME),
    MAX(SEQ_IN_INDEX),
    MAX(CASE WHEN SEQ_IN_INDEX = 1 THEN COLUMN_NAME END),
    MAX(CASE WHEN SEQ_IN_INDEX = 1 THEN SUB_PART END)
  INTO
    dedupe_index_count,
    dedupe_index_non_unique,
    dedupe_index_column_count,
    dedupe_index_max_seq,
    dedupe_index_column,
    dedupe_index_sub_part
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'automation_runs'
    AND INDEX_NAME = 'uq_automation_run_event_dedupe_key';

  IF dedupe_index_count > 0 AND (
    dedupe_index_non_unique <> 0
    OR dedupe_index_column_count <> 1
    OR dedupe_index_max_seq <> 1
    OR dedupe_index_column <> 'event_dedupe_key'
    OR dedupe_index_sub_part IS NOT NULL
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'uq_automation_run_event_dedupe_key existe com definicao incompativel';
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM automation_runs
  WHERE execution_kind = 'event'
    AND event_id IS NULL
    AND event_dedupe_key IS NOT NULL;

  IF invalid_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'evento normal sem event_id possui event_dedupe_key indevida';
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT event_dedupe_key
    FROM automation_runs
    WHERE event_dedupe_key IS NOT NULL
    GROUP BY event_dedupe_key
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'automation_runs possui duplicidades em event_dedupe_key; nova constraint nao foi criada';
  END IF;

  IF dedupe_index_count = 0 THEN
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

  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'automation_runs'
      AND INDEX_NAME = 'uq_automation_run_event_automation_version_kind'
  ) THEN
    ALTER TABLE automation_runs DROP INDEX uq_automation_run_event_automation_version_kind;
  END IF;
END$$
DELIMITER ;
CALL apply_automation_retry_event_dedupe_nullable();
DROP PROCEDURE apply_automation_retry_event_dedupe_nullable;

-- Rollback manual, somente após arquivar retries manuais:
-- ALTER TABLE automation_runs DROP INDEX uq_automation_run_event_dedupe_key;
-- ALTER TABLE automation_runs DROP COLUMN event_dedupe_key;
-- ALTER TABLE automation_runs DROP COLUMN execution_kind;
-- ALTER TABLE automation_runs ADD UNIQUE KEY uq_automation_run_event_automation_version
--   (event_id, automation_id, automation_version_id);
