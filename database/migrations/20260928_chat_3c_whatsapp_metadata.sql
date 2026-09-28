-- Kaizen CRM - CHAT-3C: WhatsApp metadata, groups and participant identity.
-- Incremental and non-destructive. Do not execute automatically in production.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_chat_3c_metadata_schema;
DELIMITER $$
CREATE PROCEDURE apply_chat_3c_metadata_schema()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'conversation_type') THEN
    ALTER TABLE conversations ADD COLUMN conversation_type VARCHAR(20) NOT NULL DEFAULT 'contact' AFTER channel;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'display_name') THEN
    ALTER TABLE conversations ADD COLUMN display_name VARCHAR(191) NULL AFTER external_conversation_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'profile_picture_url') THEN
    ALTER TABLE conversations ADD COLUMN profile_picture_url TEXT NULL AFTER display_name;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'profile_picture_updated_at') THEN
    ALTER TABLE conversations ADD COLUMN profile_picture_updated_at DATETIME NULL AFTER profile_picture_url;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'participant_count') THEN
    ALTER TABLE conversations ADD COLUMN participant_count INT UNSIGNED NULL AFTER profile_picture_updated_at;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'sender_name') THEN
    ALTER TABLE communication_messages ADD COLUMN sender_name VARCHAR(191) NULL AFTER external_sender_id;
  END IF;
  UPDATE conversations SET conversation_type = 'group' WHERE external_conversation_id LIKE '%@g.us' AND conversation_type <> 'group';
END$$
DELIMITER ;
CALL apply_chat_3c_metadata_schema();
DROP PROCEDURE IF EXISTS apply_chat_3c_metadata_schema;

CREATE TABLE IF NOT EXISTS conversation_participants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  external_participant_id VARCHAR(191) NOT NULL,
  display_name VARCHAR(191) NULL,
  participant_role VARCHAR(30) NOT NULL DEFAULT 'participant',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversation_participant (conversation_id, external_participant_id),
  KEY idx_conversation_participants_conversation (conversation_id),
  CONSTRAINT fk_conversation_participants_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
