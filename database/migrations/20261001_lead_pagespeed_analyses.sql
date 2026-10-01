-- Isolated PageSpeed/Lighthouse cache and queue. Do not execute automatically.
USE kaizen_crm;

CREATE TABLE IF NOT EXISTS lead_pagespeed_analyses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prospect_id BIGINT UNSIGNED NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  website_url VARCHAR(2048) NOT NULL,
  strategy VARCHAR(20) NOT NULL DEFAULT 'mobile',
  status ENUM('pending', 'processing', 'completed', 'partial', 'failed') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  analyzed_at DATETIME NULL,
  refresh_after DATETIME NULL,
  score TINYINT UNSIGNED NULL,
  lab_payload JSON NULL,
  field_payload JSON NULL,
  opportunities_payload JSON NULL,
  last_error VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pagespeed_prospect_strategy (prospect_id, strategy),
  KEY idx_pagespeed_queue (status, available_at),
  KEY idx_pagespeed_owner (owner_user_id),
  KEY idx_pagespeed_refresh (refresh_after),
  CONSTRAINT fk_pagespeed_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pagespeed_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
