# Fase 2C: Domain Events e Event Dispatcher

## Regra da fase

**Phase 2C records domain events but does not execute automations.** Cada operação conectada grava somente em `automation_events`. Nenhuma operação desta fase cria `automation_runs`, `automation_run_steps` ou `automation_jobs`.

## Arquitetura

`server/services/domain-events.js` é a fronteira única para validação, sanitização, UUID, idempotência, correlation/causation e persistência. O dispatcher aceita `{ connection }`; quando recebe uma conexão existente, participa da mesma transação da operação comercial. Sem conexão, abre uma operação própria.

O catálogo oficial é o da Fase 2B: `lead.created`, `lead.updated`, `lead.status_changed`, `lead.pipeline_stage_changed`, `lead.tag_added`, `lead.tag_removed`, `lead.assigned`, `lead.converted`, `activity.created` e `activity.completed`.

## Contratos de payload

- `lead.created`: `leadId`, `source`, `status`, `assignedUserId`.
- `lead.updated`: `leadId`, `changedFields`.
- `lead.status_changed`: `leadId`, `oldStatus`, `newStatus`.
- `lead.pipeline_stage_changed`: `leadId`, `pipelineId`, `oldStageId`, `newStageId`.
- `lead.tag_added`/`lead.tag_removed`: `leadId`, `labelId`.
- `lead.assigned`: `leadId`, `oldUserId`, `newUserId`.
- `activity.created`: `activityId`, `leadId`, `type`, `assignedUserId`, `dueAt`.
- `activity.completed`: `activityId`, `leadId`, `completedBy`, `completedAt`.

Conversão não foi conectada: o backend atual não tem uma transição explícita e inequívoca de conversão separada de seus status. Não foi criada uma regra nova.

## Eventos conectados

- Criação e edição de Lead em `prospection.js`.
- Mudança de status e responsável em edição de Lead.
- Movimentação de Pipeline em `commercial-entities.js`, com `SELECT ... FOR UPDATE` da posição.
- Diferença real de etiquetas adicionadas/removidas.
- Criação e transição real para concluída de atividades.

Eventos sem mudança semântica não são emitidos: mesma etapa, mesmo status, mesmo responsável, etiqueta já existente ou atividade já concluída.

## Consistência e concorrência

Pipeline, etiquetas, atividades e criação/edição de Lead gravam operação e evento na mesma transação MySQL. Falha em qualquer parte causa rollback. A posição da Pipeline e a atividade são lidas com lock antes da decisão; isso evita emitir um `oldStageId` ou status obsoleto em concorrência.

## Idempotência

`automation_events.idempotency_key` é respeitada quando o cliente envia `Idempotency-Key`. A chave persistida combina a chave da requisição, tipo, entidade e fingerprint do payload; isso permite várias etiquetas no mesmo request sem colidir. Antes do insert, o dispatcher consulta a chave; em uma corrida, trata `ER_DUP_ENTRY` somente após confirmar tipo e entidade e devolve o evento existente. Sem chave de requisição, cada operação real recebe um `event_uuid` novo. O `event_uuid` é gerado por `crypto.randomUUID()`.

## Correlation, causation e ator

`X-Correlation-Id` é preservado quando é UUID válido; se ausente, cada operação humana inicia uma nova cadeia. `X-Causation-Id` é aceito pela camada central, e permanece nulo para operações humanas atuais. `actor_user_id` vem de `req.userId`, nunca do corpo da requisição.

## Sanitização e observabilidade

Os contratos são construídos com dados mínimos. O sanitizador remove chaves sensíveis, incluindo senha, hash, Authorization, JWT, token, secret, API key e refresh token. O log registra apenas tipo, UUID, entidade e ID; não registra payload, cabeçalhos ou credenciais.

## Consulta administrativa

Administradores podem consultar `GET /api/automation-events` com `event_type`, `entity_type`, `entity_id`, `correlation_id`, `from`, `to`, `page` e `page_size` (máximo 100). `GET /api/automation-events/:id` retorna detalhes e payload. A interface está em `/comercial/automacoes/eventos`, com filtros, paginação e visualização do payload.

Não há retenção automática, cron, worker, processamento de jobs ou execução de ações nesta fase.
