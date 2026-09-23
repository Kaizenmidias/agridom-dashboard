# Fase 2D.2 — Construtor visual de automações

## Entrega

O detalhe de uma automação agora possui um construtor horizontal com gatilho, condição, espera, ação e finalização. O canvas permite selecionar, arrastar, duplicar e excluir blocos, organizar o fluxo, ajustar zoom e visualizar as conexões entre os caminhos.

O painel lateral configura os campos do bloco e consulta as opções reais de pipelines, etapas, etiquetas e usuários pelas APIs comerciais já existentes.

## Catálogo de ações

Na revisão 2D.2.1, o canvas passou a dominar a área útil, o inspetor virou um Drawer sobreposto e o botão `+` abre um Action Picker pesquisável por nome, categoria e sinônimos. Os nós ficaram compactos e mostram apenas a informação essencial.

O catálogo tipado fica em `src/components/automations/action-catalog.ts` e a allowlist autoritativa fica em `server/services/automation-catalog.js`. Ele cobre CRM, comunicação, Instagram, tempo, dados e integrações futuras. Cada item informa disponibilidade: `Disponível`, `Requer integração` ou `Em breve`.

Na Fase 2E.1, as ações internas de CRM, etiquetas, pipeline, atividades, notificações e waits persistentes passaram a possuir executor real. E-mail, WhatsApp e Instagram continuam bloqueados como `Requer integração`; não há scraping, credencial fictícia ou executor HTTP genérico.

O Drawer inclui configuração contextual e um seletor de variáveis permitidas. O backend aceita somente `lead.name`, `lead.first_name`, `lead.company`, `lead.phone`, `lead.email`, `assignee.name`, `assignee.email`, `pipeline.name` e `pipeline.stage`.

## Persistência

As posições `x` e `y` são apenas apresentação. O editor converte os blocos para o contrato `schemaVersion: 1` existente, usando `trigger`, `steps`, `next` e `branches`. Nós `finish` são aceitos pelo validador como terminais sem ação. Esperas usam `amount` e `unit` (`minutes`, `hours` ou `days`).

Foi adicionado `PATCH /api/automations/:id/versions/:versionId` para atualizar um rascunho dentro de uma transação. Versões publicadas continuam imutáveis e toda alteração gera auditoria.

## Limites desta fase

O construtor não executa ações externas e não usa `setTimeout`. O worker percorre os steps com jobs persistentes, retries, locks e retomada de waits. Actions externas continuam sem executor até a configuração dos providers.

## Operação

Crie uma automação, abra seu detalhe, adicione um rascunho e monte o fluxo. Salve o rascunho no próprio canvas e publique pela tabela de versões depois da validação do backend.
