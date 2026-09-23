-- Kaizen CRM - Fase 2A: consolidacao das entidades comerciais
-- Migration incremental, nao destrutiva, para MySQL 8+ / MariaDB 10.6+.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS pipeline_definitions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pipeline_owner (owner_user_id),
  CONSTRAINT fk_pipeline_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pipeline_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  color VARCHAR(20) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pipeline_stages_order (pipeline_id, sort_order),
  CONSTRAINT fk_stage_pipeline FOREIGN KEY (pipeline_id) REFERENCES pipeline_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospect_pipeline_positions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prospect_id BIGINT UNSIGNED NOT NULL,
  pipeline_id BIGINT UNSIGNED NOT NULL,
  stage_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  entered_stage_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prospect_pipeline (prospect_id, pipeline_id),
  KEY idx_pipeline_position_stage (stage_id, sort_order),
  CONSTRAINT fk_position_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  CONSTRAINT fk_position_pipeline FOREIGN KEY (pipeline_id) REFERENCES pipeline_definitions(id) ON DELETE CASCADE,
  CONSTRAINT fk_position_stage FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_labels (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#4D6EDB',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lead_label_owner_name (owner_user_id, name),
  CONSTRAINT fk_label_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospect_labels (
  prospect_id BIGINT UNSIGNED NOT NULL,
  label_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (prospect_id, label_id),
  KEY idx_prospect_labels_label (label_id),
  CONSTRAINT fk_prospect_label_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  CONSTRAINT fk_prospect_label_label FOREIGN KEY (label_id) REFERENCES lead_labels(id) ON DELETE CASCADE,
  CONSTRAINT fk_prospect_label_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS migrate_phase_2a_assigned_user;
DELIMITER $$
CREATE PROCEDURE migrate_phase_2a_assigned_user()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospects' AND COLUMN_NAME = 'assigned_user_id'
  ) THEN
    ALTER TABLE prospects ADD COLUMN assigned_user_id BIGINT UNSIGNED NULL AFTER owner_user_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospects' AND INDEX_NAME = 'idx_prospects_assigned_user'
  ) THEN
    ALTER TABLE prospects ADD KEY idx_prospects_assigned_user (assigned_user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'prospects' AND CONSTRAINT_NAME = 'fk_prospects_assigned_user'
  ) THEN
    ALTER TABLE prospects ADD CONSTRAINT fk_prospects_assigned_user FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;
CALL migrate_phase_2a_assigned_user();
DROP PROCEDURE migrate_phase_2a_assigned_user;

CREATE TABLE IF NOT EXISTS lead_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prospect_id BIGINT UNSIGNED NOT NULL,
  type ENUM('task','call','follow_up','activity') NOT NULL DEFAULT 'activity',
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  assigned_user_id BIGINT UNSIGNED NULL,
  due_at DATETIME NULL,
  status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  completed_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lead_activities_prospect (prospect_id, status, due_at),
  KEY idx_lead_activities_assignee (assigned_user_id, status, due_at),
  CONSTRAINT fk_activity_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_assignee FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internal_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id VARCHAR(100) NULL,
  metadata JSON NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_internal_notifications_user (user_id, read_at, created_at),
  CONSTRAINT fk_internal_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill seguro de etiquetas presentes em analysis_report.labels.
-- Os dados antigos permanecem intactos no JSON para validacao e rollback logico.
INSERT IGNORE INTO lead_labels (owner_user_id, name, color)
SELECT p.owner_user_id,
  COALESCE(labels.label_name, labels.label_string) AS label_name,
  COALESCE(labels.label_color, '#4D6EDB') AS label_color
FROM prospects p
JOIN JSON_TABLE(
  COALESCE(p.analysis_report, JSON_OBJECT()),
  '$.labels[*]' COLUMNS (
    label_name VARCHAR(100) PATH '$.name' NULL ON EMPTY NULL ON ERROR,
    label_string VARCHAR(100) PATH '$' NULL ON EMPTY NULL ON ERROR,
    label_color VARCHAR(20) PATH '$.color' NULL ON EMPTY NULL ON ERROR
  )
) labels
WHERE p.owner_user_id IS NOT NULL
  AND COALESCE(labels.label_name, labels.label_string) IS NOT NULL
  AND COALESCE(labels.label_name, labels.label_string) <> '';

INSERT IGNORE INTO prospect_labels (prospect_id, label_id, created_by)
SELECT p.id, ll.id, p.owner_user_id
FROM prospects p
JOIN JSON_TABLE(
  COALESCE(p.analysis_report, JSON_OBJECT()),
  '$.labels[*]' COLUMNS (
    label_name VARCHAR(100) PATH '$.name' NULL ON EMPTY NULL ON ERROR,
    label_string VARCHAR(100) PATH '$' NULL ON EMPTY NULL ON ERROR
  )
) labels
JOIN lead_labels ll ON ll.owner_user_id = p.owner_user_id AND ll.name = COALESCE(labels.label_name, labels.label_string)
WHERE COALESCE(labels.label_name, labels.label_string) IS NOT NULL;

-- Backfill de responsavel somente quando existe exatamente um usuario com nome ou e-mail correspondente.
UPDATE prospects p
JOIN (
  SELECT candidate.prospect_id, MIN(candidate.user_id) AS user_id
  FROM (
    SELECT p2.id AS prospect_id, u.id AS user_id
    FROM prospects p2
    JOIN users u ON LOWER(TRIM(u.name)) = LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p2.analysis_report, '$.assignedTo'))))
      OR LOWER(TRIM(u.email)) = LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p2.analysis_report, '$.assignedTo'))))
    WHERE JSON_EXTRACT(p2.analysis_report, '$.assignedTo') IS NOT NULL
  ) candidate
  GROUP BY candidate.prospect_id
  HAVING COUNT(*) = 1
) matched ON matched.prospect_id = p.id
SET p.assigned_user_id = matched.user_id
WHERE p.assigned_user_id IS NULL;
