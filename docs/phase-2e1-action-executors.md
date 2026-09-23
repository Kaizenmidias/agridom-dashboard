# Fase 2E.1: executores internos e engine persistente

## Auditoria da base existente

A engine anterior já possuía o dispatcher de eventos, o matcher de automações,
as tabelas de runs/jobs e o worker persistente. Porém, o processamento de job
terminava em um bootstrap sem executar nós do fluxo. A Fase 2E.1 mantém esses
componentes e preenche a execução no mesmo caminho, sem criar uma segunda engine.

## Arquitetura aplicada

- `automation-catalog.js` é o catálogo único de ações e informa disponibilidade.
- `automation/action-registry.js` expõe o catálogo para a engine.
- `automation/action-executor.js` concentra as escritas internas do CRM.
- `automation/condition-evaluator.js` usa campos e operadores allowlisted.
- `automation/variable-resolver.js` resolve somente variáveis conhecidas, sem `eval`.
- `automation-engine.js` percorre condition, wait, action e finish em jobs persistentes.

Cada nó gera `automation_run_steps`, com tentativa, entrada, saída e erro. O
worker usa locks, idempotency keys, retry com backoff e recuperação de jobs
stale. Waits criam um job futuro em `execute_at`; não há `sleep` ou timer de
processo. O lineage do evento impede recursão da mesma automação e limita a
profundidade da cadeia.

## Ações internas

São executáveis: atualizar status/campo, atribuir ou remover responsável,
adicionar/remover etiqueta, adicionar observação, mover etapa, criar e concluir
atividade/tarefa/ligação/follow-up e criar notificação interna. As escritas
validam proprietário, usuário, etiqueta, etapa e campos permitidos; a execução
registra histórico do lead e publica eventos com correlação, causação e origem
da automação.

Comunicações externas, webhooks, HTTP, IA e integrações sociais permanecem
catalogadas como indisponíveis até existir integração real. A publicação rejeita
ações não executáveis, configurações obrigatórias ausentes, condições inválidas,
referências quebradas e nós órfãos.

## Banco e operação

A migration `20260923_phase_2e1_action_executors.sql` adiciona apenas os campos
de lineage necessários em `automation_events`, de forma compatível com MySQL
8.4 e sem `ADD COLUMN IF NOT EXISTS`. Ela precisa ser aplicada antes de subir
o código que publica eventos com esses campos.
