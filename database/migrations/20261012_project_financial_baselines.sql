CREATE TABLE IF NOT EXISTS project_financial_baselines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  competence_date DATE NULL,
  origin VARCHAR(50) NOT NULL DEFAULT 'legacy_opening_balance',
  idempotency_key VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_financial_baseline_project (project_id),
  UNIQUE KEY uq_project_financial_baseline_idempotency (project_id, idempotency_key),
  CONSTRAINT fk_project_financial_baseline_project FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
