# Fase 2B: fundação da Automation Engine

## Escopo

Esta fase cria a persistência, o contrato de definição, o catálogo de tipos, a administração de versões e a auditoria da engine nativa. Ela não executa automações, não registra listeners, não envia mensagens e não adiciona worker, Redis, n8n ou integrações externas.

## Modelo persistente

- `automations`: fluxo, proprietário, trigger, status e versão ativa.
- `automation_versions`: definições imutáveis após publicação, com versão única por automação.
- `automation_events`: envelope futuro de eventos, com `event_uuid` e `idempotency_key` únicos.
- `automation_runs`: execução futura ligada a evento, entidade, versão e chave idempotente.
- `automation_run_steps`: estado de cada step, tentativas e entrada/saída JSON.
- `automation_jobs`: fila persistente futura, com disponibilidade, lease, tentativas e chave idempotente.
- `automation_audit_logs`: histórico administrativo de criação, edição, publicação e mudança de estado.

Todas as relações usam `BIGINT UNSIGNED` compatível com `users.id`. Exclusões de automação, versões, runs e eventos são restritas; referências de usuários removidos tornam-se `NULL`.

## Definition JSON

```json
{
  "schemaVersion": 1,
  "trigger": { "type": "lead.created", "config": {} },
  "steps": [
    {
      "id": "notify",
      "type": "action",
      "config": { "actionType": "notification.create" },
      "next": null
    }
  ]
}
```

O validador rejeita schema desconhecido, trigger/step/action fora do catálogo, IDs inválidos ou duplicados, referências inexistentes, duração de espera inválida e chaves de segredo. A definição é validada na criação, na criação de versão e novamente na publicação.

## Ciclo de vida

Uma automação começa como `draft`. A publicação exige ao menos um step, publica uma única versão em transação, substitui a versão publicada anterior e define `active_version_id`. `pause` preserva a versão ativa; `activate` exige versão publicada; `archive` é terminal. Cada transição gera auditoria.

O backend permite apenas um rascunho por automação. O controle de acesso usa autenticação, `can_access_crm`, usuário ativo e administrador para mutações. A listagem respeita `owner_user_id` para usuários não administradores.

## Idempotência e rastreabilidade

Eventos, runs e jobs têm chaves idempotentes únicas para que o futuro dispatcher possa usar `INSERT ... ON DUPLICATE KEY` ou tratar conflito sem duplicar trabalho. `correlation_id` acompanha a cadeia da solicitação; `causation_id` identifica o evento que causou um novo evento. O dispatcher futuro deve limitar profundidade e repetir a mesma combinação de automação, versão, entidade e evento somente uma vez.

Para consumo futuro de jobs, usar transação curta com `SELECT ... FOR UPDATE SKIP LOCKED`, marcar `processing`, preencher `locked_at`/`locked_by` e aplicar lease de recuperação. Nenhum consumidor foi implementado nesta fase.

## Datas e fuso

O banco armazena `DATETIME` em UTC. O pool Node usa `timezone: 'Z'`. A API transporta ISO 8601 e a interface converte para `pt-BR`; o fuso do lead deve ser parte do contexto do futuro executor, não uma conversão implícita no banco.

## API administrativa

`GET/POST /api/automations`, `GET/PATCH /api/automations/:id`, `POST /api/automations/:id/versions`, `POST /api/automations/:id/publish`, `POST /api/automations/:id/pause`, `POST /api/automations/:id/activate`, `POST /api/automations/:id/archive`, `GET /api/automations/:id/runs` e `GET /api/automation-runs/:id`.

As rotas de runs são somente leitura e retornam vazio enquanto não houver executor. A UI administrativa oferece cadastro, edição de metadados, criação/publicação de versão, pausa, ativação, arquivamento, auditoria e consulta de runs.
