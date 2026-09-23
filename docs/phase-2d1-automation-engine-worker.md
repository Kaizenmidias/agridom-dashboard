# Fase 2D.1: Automation Matcher, Runs e Worker

## Regra da fase

**Phase 2D.1 does not execute CRM actions.** A fase valida consumo persistente, matching, criação de runs/jobs, claim, retry, recovery e observabilidade. O bootstrap do worker apenas identifica o primeiro step e grava um resultado técnico `bootstrap/no-op`.

## Estado persistente

A migration `20260923_phase_2d1_engine_worker.sql` adiciona a `automation_events`:

- `engine_status`: `pending`, `processing`, `processed`, `failed`;
- `engine_locked_at` e `engine_locked_by`;
- `engine_attempts` e `engine_last_error`;
- `engine_processed_at`.

Também cria a constraint `uq_automation_run_event_automation_version`, impedindo dois runs para o mesmo evento, automação e versão. Os índices de pending/lock evitam varredura completa.

O evento é considerado processado somente depois de todos os matches terem criado run e job na mesma transação. Zero matches é resultado válido e marca o evento como processado sem criar registros artificiais.

## Matcher e congelamento de versão

`matchAutomationsForEvent` considera somente `automations.status = 'active'`, `active_version_id` não nulo e a versão publicada apontada exatamente por esse campo. O matching compara apenas `definition.trigger.type` com `automation_events.event_type`.

Cada run guarda `automation_id`, `automation_version_id`, `event_id`, entidade, `correlation_id` e uma chave idempotente. Alterações posteriores na versão ativa não alteram runs existentes.

## Event consumer

O worker busca um evento por vez dentro de um lote configurável e usa `SELECT ... FOR UPDATE SKIP LOCKED`. A decisão de matching, criação de runs/jobs e marcação de `processed` acontece na mesma transação. Falhas registram estado `failed` com erro técnico sanitizado; locks antigos podem voltar a `pending` após o timeout.

## Jobs, claim e recovery

O primeiro job usa `job_type = engine.bootstrap` e fica imediatamente disponível. O claim atualiza atomicamente `pending` para `processing`, preenche `locked_at`/`locked_by` e incrementa `attempts`. Jobs em `processing` cujo lock ultrapassa `AUTOMATION_JOB_LOCK_TIMEOUT_MS` são recuperados; quando atingem `max_attempts`, tornam-se `failed`.

Backoff atual: 5 segundos, 30 segundos e 120 segundos, sem retry infinito. Erros armazenados e logs usam somente códigos técnicos, nunca payload, definition, JWT, Authorization ou segredos.

## Bootstrap técnico

O worker carrega a versão congelada, valida a definição publicada, marca o run como `running`, registra somente o primeiro step alcançado em `automation_run_steps` e conclui com:

```json
{
  "execution_mode": "bootstrap/no-op",
  "action_executed": false
}
```

Nenhuma action `lead.*`, atividade, notificação, e-mail ou WhatsApp é executada.

## Processos e shutdown

`server/worker.js` é um processo Node separado, sem porta HTTP. O ecosystem prepara `kaizen-crm-worker` ao lado de `kaizen-crm-api`. `SIGINT` e `SIGTERM` interrompem novas buscas, aguardam o ciclo atual, fecham o pool MySQL e encerram o processo.

Variáveis opcionais ficam somente no `.env.example`:

- `AUTOMATION_WORKER_POLL_MS=1000`;
- `AUTOMATION_WORKER_BATCH_SIZE=25`;
- `AUTOMATION_JOB_LOCK_TIMEOUT_MS=600000`.

## Status

Runs: `queued -> running -> completed`, com `failed` em erro terminal.

Jobs: `pending -> processing -> completed`, `processing -> pending` durante retry, ou `processing -> failed` após o limite. `cancelled` permanece reservado para cancelamento explícito futuro.

Pause/archive impedem novos matches porque o matcher aceita somente `active`. Runs e jobs já criados continuam associados à versão congelada; não são apagados nem cancelados silenciosamente.

## Limitações

Não existe ainda execução de actions, waits, condições, geração de novos Domain Events, cancelamento administrativo, health HTTP separado ou Fase 2D.2. Retenção continua sendo decisão futura.
