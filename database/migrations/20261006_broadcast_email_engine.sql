-- Broadcast email execution support. Additive and intentionally not executed automatically.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_broadcast_email_engine;
DELIMITER $$
CREATE PROCEDURE apply_broadcast_email_engine()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaigns' AND COLUMN_NAME = 'email_provider_id') THEN
    ALTER TABLE broadcast_campaigns ADD COLUMN email_provider_id BIGINT NULL AFTER communication_account_id;
    ALTER TABLE broadcast_campaigns ADD KEY idx_broadcast_campaign_email_provider (email_provider_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_contents' AND COLUMN_NAME = 'email_subject') THEN
    ALTER TABLE broadcast_campaign_contents ADD COLUMN email_subject VARCHAR(998) NULL AFTER text_content;
    ALTER TABLE broadcast_campaign_contents ADD COLUMN email_body_text LONGTEXT NULL AFTER email_subject;
  END IF;
END$$
DELIMITER ;
CALL apply_broadcast_email_engine();
DROP PROCEDURE IF EXISTS apply_broadcast_email_engine;
