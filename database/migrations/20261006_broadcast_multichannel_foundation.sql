-- Broadcast multichannel foundation. Additive and intentionally not executed automatically.
USE kaizen_crm;

DROP PROCEDURE IF EXISTS apply_broadcast_multichannel_foundation;
DELIMITER $$
CREATE PROCEDURE apply_broadcast_multichannel_foundation()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaigns' AND COLUMN_NAME = 'idempotency_key') THEN
    ALTER TABLE broadcast_campaigns ADD COLUMN idempotency_key VARCHAR(191) NULL AFTER created_by_user_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaigns' AND INDEX_NAME = 'uq_broadcast_campaign_owner_idempotency') THEN
    ALTER TABLE broadcast_campaigns ADD UNIQUE KEY uq_broadcast_campaign_owner_idempotency (created_by_user_id, idempotency_key);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_recipients' AND COLUMN_NAME = 'recipient_email') THEN
    ALTER TABLE broadcast_campaign_recipients ADD COLUMN recipient_email VARCHAR(320) NULL AFTER recipient_phone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_jobs' AND COLUMN_NAME = 'channel') THEN
    ALTER TABLE broadcast_campaign_jobs ADD COLUMN channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp' AFTER recipient_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_jobs' AND INDEX_NAME = 'uq_broadcast_job_campaign_recipient_channel') THEN
    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_jobs' AND INDEX_NAME = 'uq_broadcast_job_campaign_recipient') THEN
    ALTER TABLE broadcast_campaign_jobs DROP INDEX uq_broadcast_job_campaign_recipient;
    END IF;
    ALTER TABLE broadcast_campaign_jobs ADD UNIQUE KEY uq_broadcast_job_campaign_recipient_channel (campaign_id, recipient_id, channel);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaign_recipients' AND INDEX_NAME = 'idx_broadcast_recipient_email') THEN
    ALTER TABLE broadcast_campaign_recipients ADD KEY idx_broadcast_recipient_email (campaign_id, recipient_email);
  END IF;
END$$
DELIMITER ;
CALL apply_broadcast_multichannel_foundation();
DROP PROCEDURE IF EXISTS apply_broadcast_multichannel_foundation;
