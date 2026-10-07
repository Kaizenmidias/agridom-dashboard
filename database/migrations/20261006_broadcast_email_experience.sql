-- Broadcast email editor, shared signature and immutable campaign snapshot. Not executed automatically.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_broadcast_email_experience;
DELIMITER $$
CREATE PROCEDURE apply_broadcast_email_experience()
BEGIN
  CREATE TABLE IF NOT EXISTS broadcast_email_signatures (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    html_content LONGTEXT NOT NULL,
    text_content LONGTEXT NOT NULL,
    updated_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_contents' AND COLUMN_NAME = 'email_html') THEN
    ALTER TABLE broadcast_campaign_contents ADD COLUMN email_html LONGTEXT NULL AFTER email_body_text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_contents' AND COLUMN_NAME = 'email_signature_html') THEN
    ALTER TABLE broadcast_campaign_contents ADD COLUMN email_signature_html LONGTEXT NULL AFTER email_html;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_contents' AND COLUMN_NAME = 'email_signature_text') THEN
    ALTER TABLE broadcast_campaign_contents ADD COLUMN email_signature_text LONGTEXT NULL AFTER email_signature_html;
  END IF;
END$$
DELIMITER ;
CALL apply_broadcast_email_experience();
DROP PROCEDURE IF EXISTS apply_broadcast_email_experience;
