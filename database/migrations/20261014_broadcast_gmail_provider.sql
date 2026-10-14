-- Adds an explicit email provider selector for broadcast campaigns.
-- Intentionally not executed automatically.
USE kaizen_crm;
DROP PROCEDURE IF EXISTS apply_broadcast_gmail_provider;
DELIMITER $$
CREATE PROCEDURE apply_broadcast_gmail_provider()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaigns' AND COLUMN_NAME = 'email_provider') THEN
    ALTER TABLE broadcast_campaigns ADD COLUMN email_provider VARCHAR(20) NOT NULL DEFAULT 'smtp' AFTER email_provider_id;
  END IF;
END$$
DELIMITER ;
CALL apply_broadcast_gmail_provider();
DROP PROCEDURE IF EXISTS apply_broadcast_gmail_provider;

DROP PROCEDURE IF EXISTS apply_broadcast_email_suppression;
DELIMITER $$
CREATE PROCEDURE apply_broadcast_email_suppression()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_recipients' AND COLUMN_NAME = 'unsubscribe_token') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_recipients' AND COLUMN_NAME = 'unsubscribe_token' AND DATA_TYPE = 'char' AND CHARACTER_MAXIMUM_LENGTH = 64 AND IS_NULLABLE = 'YES') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'broadcast_campaign_recipients.unsubscribe_token has an incompatible definition';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_recipients' AND COLUMN_NAME = 'unsubscribe_token') THEN
    ALTER TABLE broadcast_campaign_recipients ADD COLUMN unsubscribe_token CHAR(64) NULL AFTER recipient_email;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_recipients' AND INDEX_NAME = 'uq_broadcast_recipient_unsubscribe_token') THEN
    ALTER TABLE broadcast_campaign_recipients ADD UNIQUE KEY uq_broadcast_recipient_unsubscribe_token (unsubscribe_token);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_recipients' AND COLUMN_NAME = 'recipient_phone' AND IS_NULLABLE = 'YES') THEN
    ALTER TABLE broadcast_campaign_recipients MODIFY COLUMN recipient_phone VARCHAR(50) NULL;
  END IF;
  CREATE TABLE IF NOT EXISTS broadcast_email_suppressions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(320) NOT NULL,
    reason VARCHAR(40) NOT NULL DEFAULT 'unsubscribe',
    source_campaign_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_broadcast_email_suppression_email (email),
    KEY idx_broadcast_email_suppression_campaign (source_campaign_id),
    CONSTRAINT fk_broadcast_email_suppression_campaign FOREIGN KEY (source_campaign_id) REFERENCES broadcast_campaigns(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
END$$
DELIMITER ;
CALL apply_broadcast_email_suppression();
DROP PROCEDURE IF EXISTS apply_broadcast_email_suppression;

DROP PROCEDURE IF EXISTS apply_broadcast_email_consent;
DELIMITER $$
CREATE PROCEDURE apply_broadcast_email_consent()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospects' AND COLUMN_NAME = 'email_marketing_consent') THEN
    ALTER TABLE prospects ADD COLUMN email_marketing_consent TINYINT(1) NOT NULL DEFAULT 0 AFTER email;
    ALTER TABLE prospects ADD COLUMN email_marketing_consent_at DATETIME NULL AFTER email_marketing_consent;
    ALTER TABLE prospects ADD COLUMN email_marketing_consent_source VARCHAR(80) NULL AFTER email_marketing_consent_at;
  END IF;
END$$
DELIMITER ;
CALL apply_broadcast_email_consent();
DROP PROCEDURE IF EXISTS apply_broadcast_email_consent;

CREATE TABLE IF NOT EXISTS email_marketing_consent_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prospect_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(320) NOT NULL,
  consented TINYINT(1) NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(80) NOT NULL,
  legal_basis VARCHAR(160) NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  note VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_email_consent_history_prospect (prospect_id, recorded_at),
  KEY idx_email_consent_history_email (email, recorded_at),
  CONSTRAINT fk_email_consent_history_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  CONSTRAINT fk_email_consent_history_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
