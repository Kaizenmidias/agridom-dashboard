-- Kaizen CRM - Disparos: amplia o catalogo de eventos da campanha.
-- Migration incremental. Nao executar automaticamente em producao.
USE kaizen_crm;

ALTER TABLE broadcast_campaign_events
  MODIFY COLUMN event_type ENUM(
    'created', 'updated', 'content_updated', 'recipients_added', 'recipient_removed',
    'scheduled', 'started', 'paused', 'resumed', 'cancelled', 'completed', 'failed'
  ) NOT NULL;
