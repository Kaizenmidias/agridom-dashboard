-- Kaizen CRM - Disparos 4: cadencia persistente por campanha.
-- Migration incremental. Nao executar automaticamente em producao.
USE kaizen_crm;

ALTER TABLE broadcast_campaigns
  ADD COLUMN cadence_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER scheduled_at;

CREATE INDEX idx_broadcast_campaign_cadence ON broadcast_campaigns (status, cadence_seconds);
