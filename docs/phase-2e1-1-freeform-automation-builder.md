# Fase 2E.1.1: editor free-form de automações

O builder foi redesenhado sobre `@xyflow/react`, mantendo a engine e o
contrato operacional da Fase 2E.1. O canvas agora é controlado pelo grafo:
nodes podem ser adicionados pela biblioteca lateral, arrastados livremente,
conectados por handles, reconectados e removidos sem apagar os demais nodes.

Automações novas começam com canvas vazio. O node `finish` não aparece na
biblioteca e não é necessário para publicação: um caminho sem edge de saída é
terminal implícito. Definitions antigas que possuem `finish` continuam sendo
renderizadas e podem ser editadas.

O editor converte as edges para o contrato existente: `next` para caminhos
lineares e `branches.yes`/`branches.no` para condições. Posições ficam em
`definition.layout.nodes` e não alteram a semântica da execução. O backend
continua sendo a autoridade para validar publicação, referências, ações,
condições, ciclos e permissões.

Incluído no editor:

- biblioteca lateral com busca, categorias recolhíveis e disponibilidade;
- drag-and-drop e criação por clique;
- handles de entrada/saída e dois outputs para condição;
- seleção, remoção de node/edge, reconexão e proteção contra ciclos;
- pan, zoom, fit view, minimap e auto-layout manual;
- configuração do node na própria lateral;
- undo/redo local, `Delete`, `Ctrl+Z`, `Ctrl+Shift+Z` e `Ctrl+S`;
- persistência de posições ao salvar o rascunho.

Não foi criada migration. A troca de biblioteca foi registrada no `package.json`
e no lockfile.
