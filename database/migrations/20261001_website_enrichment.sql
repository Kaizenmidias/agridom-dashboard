-- Persistent queue and current website enrichment snapshot.
-- Apply manually after reviewing the production preflight.
CREATE TABLE IF NOT EXISTS lead_website_enrichments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prospect_id BIGINT UNSIGNED NOT NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  website_url TEXT NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'partial', 'failed') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  last_error VARCHAR(500) NULL,
  diagnostic_payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lead_website_enrichments_prospect (prospect_id),
  KEY idx_lead_website_enrichments_queue (status, available_at),
  KEY idx_lead_website_enrichments_owner (owner_user_id),
  CONSTRAINT fk_lead_website_enrichments_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_website_enrichments_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
