CREATE TABLE IF NOT EXISTS broadcast_campaign_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  mime_type VARCHAR(127) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_broadcast_email_attachment_key (storage_key),
  KEY idx_broadcast_email_attachment_campaign (campaign_id, id),
  CONSTRAINT fk_broadcast_email_attachment_campaign FOREIGN KEY (campaign_id)
    REFERENCES broadcast_campaigns (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
