# Fase 2D.2 — Construtor visual de automações

## Entrega

O detalhe de uma automação agora possui um construtor horizontal com gatilho, condição, espera, ação e finalização. O canvas permite selecionar, arrastar, duplicar e excluir blocos, organizar o fluxo, ajustar zoom e visualizar as conexões entre os caminhos.

O painel lateral configura os campos do bloco e consulta as opções reais de pipelines, etapas, etiquetas e usuários pelas APIs comerciais já existentes.

## Persistência

As posições `x` e `y` são apenas apresentação. O editor converte os blocos para o contrato `schemaVersion: 1` existente, usando `trigger`, `steps`, `next` e `branches`. Nós `finish` são aceitos pelo validador como terminais sem ação. Esperas usam `amount` e `unit` (`minutes`, `hours` ou `days`).

Foi adicionado `PATCH /api/automations/:id/versions/:versionId` para atualizar um rascunho dentro de uma transação. Versões publicadas continuam imutáveis e toda alteração gera auditoria.

## Limites desta fase

O construtor não executa ações externas e não usa `setTimeout`. A engine da Fase 2D.1 permanece responsável pelo worker persistente, que ainda faz o bootstrap técnico no-op previsto naquela fase. O editor oferece apenas ações internas catalogadas para preparar o contrato das próximas fases.

## Operação

Crie uma automação, abra seu detalhe, adicione um rascunho e monte o fluxo. Salve o rascunho no próprio canvas e publique pela tabela de versões depois da validação do backend.
