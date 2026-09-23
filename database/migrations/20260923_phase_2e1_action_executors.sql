-- Kaizen CRM - Fase 2E.1: execucao persistente de actions internas.
-- Incremental e nao destrutiva. Nao executar automaticamente em producao.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_phase_2e1_schema;
DELIMITER $$
CREATE PROCEDURE apply_phase_2e1_schema()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND COLUMN_NAME = 'source_automation_id') THEN
    ALTER TABLE automation_events ADD COLUMN source_automation_id BIGINT UNSIGNED NULL AFTER causation_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND COLUMN_NAME = 'lineage_depth') THEN
    ALTER TABLE automation_events ADD COLUMN lineage_depth INT UNSIGNED NOT NULL DEFAULT 0 AFTER source_automation_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_events' AND INDEX_NAME = 'idx_automation_events_lineage') THEN
    ALTER TABLE automation_events ADD KEY idx_automation_events_lineage (correlation_id, source_automation_id, lineage_depth);
  END IF;
END$$
DELIMITER ;
CALL apply_phase_2e1_schema();
DROP PROCEDURE apply_phase_2e1_schema;
