-- Kaizen CRM - Fase B.1A: endpoints administrativos de Webhook.
-- Esta migration somente cria a fundacao de credenciais. Nenhum webhook e recebido.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS automation_webhook_endpoints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  automation_id BIGINT UNSIGNED NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active_automation_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN revoked_at IS NULL THEN automation_id ELSE NULL END) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_automation_webhook_token_hash (token_hash),
  UNIQUE KEY uq_automation_webhook_active_automation (active_automation_id),
  KEY idx_automation_webhook_owner (owner_user_id, enabled),
  CONSTRAINT fk_automation_webhook_automation FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  CONSTRAINT fk_automation_webhook_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
