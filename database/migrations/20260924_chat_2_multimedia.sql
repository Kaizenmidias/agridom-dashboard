-- Kaizen CRM - CHAT-2: multimedia messages and private media metadata.
-- Incremental and non-destructive. Do not execute automatically in production.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_chat_2_multimedia_schema;
DELIMITER $$
CREATE PROCEDURE apply_chat_2_multimedia_schema()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'media_storage_path') THEN
    ALTER TABLE communication_messages ADD COLUMN media_storage_path VARCHAR(255) NULL AFTER metadata;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'media_mime_type') THEN
    ALTER TABLE communication_messages ADD COLUMN media_mime_type VARCHAR(150) NULL AFTER media_storage_path;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'media_filename') THEN
    ALTER TABLE communication_messages ADD COLUMN media_filename VARCHAR(255) NULL AFTER media_mime_type;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'media_size_bytes') THEN
    ALTER TABLE communication_messages ADD COLUMN media_size_bytes BIGINT UNSIGNED NULL AFTER media_filename;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'media_duration_seconds') THEN
    ALTER TABLE communication_messages ADD COLUMN media_duration_seconds DECIMAL(10, 3) NULL AFTER media_size_bytes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'media_width') THEN
    ALTER TABLE communication_messages ADD COLUMN media_width INT UNSIGNED NULL AFTER media_duration_seconds;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'media_height') THEN
    ALTER TABLE communication_messages ADD COLUMN media_height INT UNSIGNED NULL AFTER media_width;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'quoted_message_id') THEN
    ALTER TABLE communication_messages ADD COLUMN quoted_message_id BIGINT UNSIGNED NULL AFTER media_height;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'media_status') THEN
    ALTER TABLE communication_messages ADD COLUMN media_status VARCHAR(30) NULL AFTER quoted_message_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND INDEX_NAME = 'idx_communication_quoted_message') THEN
    ALTER TABLE communication_messages ADD KEY idx_communication_quoted_message (quoted_message_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND CONSTRAINT_NAME = 'fk_communication_quoted_message') THEN
    ALTER TABLE communication_messages ADD CONSTRAINT fk_communication_quoted_message FOREIGN KEY (quoted_message_id) REFERENCES communication_messages(id) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;
CALL apply_chat_2_multimedia_schema();
DROP PROCEDURE IF EXISTS apply_chat_2_multimedia_schema;
