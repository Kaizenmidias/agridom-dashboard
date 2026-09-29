-- Pastas manuais de Leads compartilhadas com o modulo de Disparos.
-- Migration incremental. Nao executar automaticamente em producao.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS lead_folders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  icon VARCHAR(40) NOT NULL DEFAULT 'folder',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lead_folder_owner_name (owner_user_id, name),
  KEY idx_lead_folder_owner (owner_user_id, created_at),
  CONSTRAINT fk_lead_folder_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_folder_members (
  folder_id BIGINT UNSIGNED NOT NULL,
  prospect_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (folder_id, prospect_id),
  KEY idx_lead_folder_member_prospect (prospect_id),
  CONSTRAINT fk_lead_folder_member_folder FOREIGN KEY (folder_id) REFERENCES lead_folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_folder_member_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
