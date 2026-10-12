-- Preserva projetos e seu historico financeiro, removendo-os dos indicadores operacionais.
SET @has_deleted_at := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'deleted_at'
);
SET @add_deleted_at_sql := IF(@has_deleted_at = 0,
  'ALTER TABLE projects ADD COLUMN deleted_at DATETIME NULL AFTER completion_date',
  'SELECT 1');
PREPARE add_deleted_at_stmt FROM @add_deleted_at_sql;
EXECUTE add_deleted_at_stmt;
DEALLOCATE PREPARE add_deleted_at_stmt;

SET @has_deleted_at_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND INDEX_NAME = 'idx_projects_deleted_at'
);
SET @add_deleted_at_index_sql := IF(@has_deleted_at_index = 0,
  'ALTER TABLE projects ADD KEY idx_projects_deleted_at (deleted_at)',
  'SELECT 1');
PREPARE add_deleted_at_index_stmt FROM @add_deleted_at_index_sql;
EXECUTE add_deleted_at_index_stmt;
DEALLOCATE PREPARE add_deleted_at_index_stmt;
