-- Kaizen CRM - Disparos 2C: fila persistente de campanhas.
-- Migration incremental. Nao executar automaticamente em producao.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS broadcast_campaign_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  recipient_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 3,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_by VARCHAR(100) NULL,
  locked_at DATETIME NULL,
  last_error VARCHAR(500) NULL,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_broadcast_job_campaign_recipient (campaign_id, recipient_id),
  KEY idx_broadcast_jobs_available (status, available_at),
  KEY idx_broadcast_jobs_lock (status, locked_at),
  KEY idx_broadcast_jobs_campaign (campaign_id, status),
  CONSTRAINT fk_broadcast_job_campaign FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_broadcast_job_recipient FOREIGN KEY (recipient_id) REFERENCES broadcast_campaign_recipients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
