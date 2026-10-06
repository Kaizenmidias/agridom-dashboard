-- Compartilha projetos internamente e relaciona cada projeto a um briefing operacional.
-- Idempotente; executar somente pelo processo oficial de migrations.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS migrate_shared_projects_briefings;
DELIMITER $$
CREATE PROCEDURE migrate_shared_projects_briefings()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'briefings' AND COLUMN_NAME = 'project_id'
  ) THEN
    ALTER TABLE briefings ADD COLUMN project_id BIGINT UNSIGNED NULL AFTER id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'briefings' AND INDEX_NAME = 'uq_briefings_project'
  ) THEN
    ALTER TABLE briefings ADD UNIQUE KEY uq_briefings_project (project_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'briefings' AND CONSTRAINT_NAME = 'fk_briefings_project'
  ) THEN
    ALTER TABLE briefings ADD CONSTRAINT fk_briefings_project
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END$$
DELIMITER ;
CALL migrate_shared_projects_briefings();
DROP PROCEDURE migrate_shared_projects_briefings;

-- Compatibilidade: cria exatamente um briefing operacional para cada projeto antigo.
INSERT INTO briefings (project_id, user_id, title, client, client_name, project_type, description, content, status, priority, deadline)
SELECT p.id, p.user_id, p.name, COALESCE(p.client, p.client_name), COALESCE(p.client, p.client_name),
       p.project_type, p.description, p.description, 'pending', 'medium', p.delivery_date
FROM projects p
LEFT JOIN briefings b ON b.project_id = p.id
WHERE b.id IS NULL;
