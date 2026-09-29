-- Kaizen CRM - Disparos 2A: dominio persistente de campanhas.
-- Migration incremental. Nao executar automaticamente em producao.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  channel VARCHAR(40) NOT NULL DEFAULT 'whatsapp',
  communication_account_id BIGINT UNSIGNED NULL,
  status ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed') NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  paused_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_broadcast_campaign_status (status),
  KEY idx_broadcast_campaign_scheduled (scheduled_at, status),
  KEY idx_broadcast_campaign_account (communication_account_id),
  KEY idx_broadcast_campaign_created (created_by_user_id, created_at),
  CONSTRAINT fk_broadcast_campaign_account FOREIGN KEY (communication_account_id) REFERENCES communication_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_broadcast_campaign_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_campaign_contents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  content_type ENUM('text', 'image', 'video', 'document', 'audio') NOT NULL DEFAULT 'text',
  text_content LONGTEXT NULL,
  media_storage_path VARCHAR(500) NULL,
  mime_type VARCHAR(150) NULL,
  original_filename VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_broadcast_campaign_content (campaign_id),
  CONSTRAINT fk_broadcast_content_campaign FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_campaign_recipients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  prospect_id BIGINT UNSIGNED NULL,
  recipient_phone VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(255) NULL,
  status ENUM('pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped', 'cancelled') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NULL,
  last_attempt_at DATETIME NULL,
  sent_at DATETIME NULL,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  failed_at DATETIME NULL,
  last_error TEXT NULL,
  communication_message_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_broadcast_recipient_campaign_prospect (campaign_id, prospect_id),
  UNIQUE KEY uq_broadcast_recipient_campaign_phone (campaign_id, recipient_phone),
  KEY idx_broadcast_recipient_campaign_status (campaign_id, status),
  KEY idx_broadcast_recipient_prospect (prospect_id),
  KEY idx_broadcast_recipient_next_attempt (next_attempt_at, status),
  KEY idx_broadcast_recipient_message (communication_message_id),
  CONSTRAINT fk_broadcast_recipient_campaign FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_broadcast_recipient_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL,
  CONSTRAINT fk_broadcast_recipient_message FOREIGN KEY (communication_message_id) REFERENCES communication_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_campaign_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('created', 'scheduled', 'started', 'paused', 'resumed', 'cancelled', 'completed', 'failed') NOT NULL,
  metadata JSON NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_broadcast_event_campaign_time (campaign_id, created_at),
  KEY idx_broadcast_event_type (event_type, created_at),
  CONSTRAINT fk_broadcast_event_campaign FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_broadcast_event_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
