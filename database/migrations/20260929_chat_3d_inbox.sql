-- CHAT-3D: inbox organization. Incremental and non-destructive.
USE kaizen_crm;
DROP PROCEDURE IF EXISTS apply_chat_3d_inbox_schema;
DELIMITER $$
CREATE PROCEDURE apply_chat_3d_inbox_schema()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'pinned_at') THEN ALTER TABLE conversations ADD COLUMN pinned_at DATETIME NULL AFTER status; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'archived_at') THEN ALTER TABLE conversations ADD COLUMN archived_at DATETIME NULL AFTER pinned_at; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'hidden_at') THEN ALTER TABLE conversations ADD COLUMN hidden_at DATETIME NULL AFTER archived_at; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'manual_unread') THEN ALTER TABLE conversations ADD COLUMN manual_unread TINYINT(1) NOT NULL DEFAULT 0 AFTER unread_count; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'communication_messages' AND COLUMN_NAME = 'starred_at') THEN ALTER TABLE communication_messages ADD COLUMN starred_at DATETIME NULL AFTER delivery_status; END IF;
END$$
DELIMITER ;
CALL apply_chat_3d_inbox_schema();
DROP PROCEDURE IF EXISTS apply_chat_3d_inbox_schema;
