-- Fase 1: fundacao segura da integracao Gmail.
-- Esta migration e manual e nao deve ser executada no startup da aplicacao.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS gmail_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_key VARCHAR(191) NOT NULL DEFAULT 'default',
  provider VARCHAR(40) NOT NULL DEFAULT 'google_gmail',
  google_account_id VARCHAR(255) NULL,
  email_address VARCHAR(320) NULL,
  display_name VARCHAR(255) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'disconnected',
  refresh_token_ciphertext TEXT NULL,
  refresh_token_iv VARCHAR(64) NULL,
  refresh_token_auth_tag VARCHAR(64) NULL,
  scopes_granted JSON NULL,
  connected_by_user_id BIGINT UNSIGNED NULL,
  connected_at DATETIME NULL,
  last_refreshed_at DATETIME NULL,
  last_error_code VARCHAR(100) NULL,
  disconnected_at DATETIME NULL,
  current_scope_key VARCHAR(191) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gmail_current_scope (scope_key, current_scope_key),
  KEY idx_gmail_connection_status (scope_key, status),
  KEY idx_gmail_connection_account (google_account_id),
  CONSTRAINT fk_gmail_connection_user FOREIGN KEY (connected_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_gmail_connection_status CHECK (status IN ('disconnected', 'connecting', 'connected', 'reconnect_required', 'error')),
  CONSTRAINT chk_gmail_connection_current CHECK (
    current_scope_key IS NULL
    OR (
      current_scope_key = scope_key
      AND status IN ('connecting', 'connected', 'reconnect_required', 'error')
    )
  ),
  CONSTRAINT chk_gmail_connected_is_current CHECK (
    status <> 'connected' OR current_scope_key = scope_key
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gmail_oauth_states (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  state_hash CHAR(64) NOT NULL,
  initiated_by_user_id BIGINT UNSIGNED NOT NULL,
  code_verifier_ciphertext TEXT NULL,
  code_verifier_iv VARCHAR(64) NULL,
  code_verifier_auth_tag VARCHAR(64) NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gmail_oauth_state_hash (state_hash),
  KEY idx_gmail_oauth_state_expiry (expires_at, consumed_at),
  CONSTRAINT fk_gmail_oauth_state_user FOREIGN KEY (initiated_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
