-- AUTOMATIONS-3A: persistent WhatsApp cadence reservation.
-- Review and apply manually in the target MySQL database; this migration is not executed by the application.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS automation_whatsapp_cadence (
  automation_id BIGINT UNSIGNED NOT NULL,
  communication_account_id BIGINT UNSIGNED NOT NULL,
  next_available_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (automation_id, communication_account_id),
  CONSTRAINT fk_automation_cadence_automation FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  CONSTRAINT fk_automation_cadence_account FOREIGN KEY (communication_account_id) REFERENCES communication_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
