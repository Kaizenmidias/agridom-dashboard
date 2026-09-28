-- CHAT-3C: participant display details. Incremental and non-destructive.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_chat_3c_participant_details;
DELIMITER $$
CREATE PROCEDURE apply_chat_3c_participant_details()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversation_participants' AND COLUMN_NAME = 'phone') THEN
    ALTER TABLE conversation_participants ADD COLUMN phone VARCHAR(40) NULL AFTER display_name;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversation_participants' AND COLUMN_NAME = 'profile_picture_url') THEN
    ALTER TABLE conversation_participants ADD COLUMN profile_picture_url TEXT NULL AFTER phone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversation_participants' AND COLUMN_NAME = 'profile_picture_updated_at') THEN
    ALTER TABLE conversation_participants ADD COLUMN profile_picture_updated_at DATETIME NULL AFTER profile_picture_url;
  END IF;
END$$
DELIMITER ;
CALL apply_chat_3c_participant_details();
DROP PROCEDURE IF EXISTS apply_chat_3c_participant_details;
