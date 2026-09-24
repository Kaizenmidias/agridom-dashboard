-- Kaizen CRM - Fase 2G.2: WhatsApp/Evolution e fundacao omnichannel.
-- Migration incremental. Nao executar automaticamente em producao.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS communication_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel VARCHAR(40) NOT NULL,
  provider VARCHAR(80) NOT NULL,
  name VARCHAR(150) NOT NULL,
  external_instance_id VARCHAR(191) NOT NULL,
  phone_number VARCHAR(50) NULL,
  display_name VARCHAR(150) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  integration_provider_id BIGINT UNSIGNED NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  auto_create_leads TINYINT(1) NOT NULL DEFAULT 1,
  metadata JSON NULL,
  last_connected_at DATETIME NULL,
  last_disconnected_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_communication_account_instance (provider, external_instance_id),
  KEY idx_communication_account_channel_status (channel, status, archived_at),
  KEY idx_communication_account_owner (owner_user_id),
  CONSTRAINT fk_communication_account_provider FOREIGN KEY (integration_provider_id) REFERENCES integration_providers(id) ON DELETE SET NULL,
  CONSTRAINT fk_communication_account_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel VARCHAR(40) NOT NULL,
  communication_account_id BIGINT UNSIGNED NOT NULL,
  lead_id BIGINT UNSIGNED NULL,
  external_conversation_id VARCHAR(191) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  handling_mode VARCHAR(20) NOT NULL DEFAULT 'human',
  assigned_user_id BIGINT UNSIGNED NULL,
  ai_agent_id BIGINT UNSIGNED NULL,
  last_message_at DATETIME NULL,
  last_inbound_at DATETIME NULL,
  last_outbound_at DATETIME NULL,
  unread_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversation_account_external (communication_account_id, external_conversation_id),
  KEY idx_conversations_account_status (communication_account_id, status, last_message_at),
  KEY idx_conversations_lead (lead_id),
  KEY idx_conversations_assignee (assigned_user_id),
  CONSTRAINT fk_conversations_account FOREIGN KEY (communication_account_id) REFERENCES communication_accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_conversations_lead FOREIGN KEY (lead_id) REFERENCES prospects(id) ON DELETE SET NULL,
  CONSTRAINT fk_conversations_assignee FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS communication_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  communication_account_id BIGINT UNSIGNED NULL,
  external_event_id VARCHAR(191) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  error_code VARCHAR(100) NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_communication_webhook_event (external_event_id),
  KEY idx_communication_webhook_pending (status, received_at),
  CONSTRAINT fk_communication_webhook_account FOREIGN KEY (communication_account_id) REFERENCES communication_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS apply_phase_2g2_message_schema;
DELIMITER $$
CREATE PROCEDURE apply_phase_2g2_message_schema()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'conversation_id') THEN
    ALTER TABLE communication_messages ADD COLUMN conversation_id BIGINT UNSIGNED NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'communication_account_id') THEN
    ALTER TABLE communication_messages ADD COLUMN communication_account_id BIGINT UNSIGNED NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'external_message_id') THEN
    ALTER TABLE communication_messages ADD COLUMN external_message_id VARCHAR(191) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'external_sender_id') THEN
    ALTER TABLE communication_messages ADD COLUMN external_sender_id VARCHAR(191) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'message_type') THEN
    ALTER TABLE communication_messages ADD COLUMN message_type VARCHAR(30) NOT NULL DEFAULT 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'delivery_status') THEN
    ALTER TABLE communication_messages ADD COLUMN delivery_status VARCHAR(30) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'metadata') THEN
    ALTER TABLE communication_messages ADD COLUMN metadata JSON NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND INDEX_NAME = 'idx_communication_conversation') THEN
    ALTER TABLE communication_messages ADD KEY idx_communication_conversation (conversation_id, created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND INDEX_NAME = 'idx_communication_account_external') THEN
    ALTER TABLE communication_messages ADD KEY idx_communication_account_external (communication_account_id, external_message_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND INDEX_NAME = 'uq_communication_external_message') THEN
    ALTER TABLE communication_messages ADD UNIQUE KEY uq_communication_external_message (communication_account_id, external_message_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND CONSTRAINT_NAME = 'fk_communication_conversation') THEN
    ALTER TABLE communication_messages ADD CONSTRAINT fk_communication_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND CONSTRAINT_NAME = 'fk_communication_account') THEN
    ALTER TABLE communication_messages ADD CONSTRAINT fk_communication_account FOREIGN KEY (communication_account_id) REFERENCES communication_accounts(id) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;
CALL apply_phase_2g2_message_schema();
DROP PROCEDURE IF EXISTS apply_phase_2g2_message_schema;

DROP PROCEDURE IF EXISTS apply_phase_2g2_lead_schema;
DELIMITER $$
CREATE PROCEDURE apply_phase_2g2_lead_schema()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospects' AND COLUMN_NAME = 'origin') THEN
    ALTER TABLE prospects ADD COLUMN origin VARCHAR(100) NULL AFTER status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospects' AND INDEX_NAME = 'idx_prospects_normalized_phone') THEN
    ALTER TABLE prospects ADD KEY idx_prospects_normalized_phone (normalized_phone);
  END IF;
END$$
DELIMITER ;
CALL apply_phase_2g2_lead_schema();
DROP PROCEDURE IF EXISTS apply_phase_2g2_lead_schema;
