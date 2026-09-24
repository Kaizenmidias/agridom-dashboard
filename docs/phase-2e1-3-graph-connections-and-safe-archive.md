# Fase 2E.1.3

## Conexoes do fluxo

O editor visual persiste a conexao de saida do gatilho em `trigger.next`.
As conexoes entre steps continuam representadas por `next` e `branches.yes` /
`branches.no`. As coordenadas ficam em `layout` e nao participam da execucao.

Ao publicar uma definicao nova com steps, o gatilho precisa apontar para um
step existente. O validador retorna `TRIGGER_NOT_CONNECTED` quando isso nao
acontece. Definicoes legadas sem `layout` recebem uma normalizacao de
compatibilidade para o primeiro step durante a validacao; novos grafos nao
usam a ordem visual como inferencia.

Conexoes podem ser reconectadas, selecionadas e removidas individualmente.
`Delete`/`Backspace`, o botao de remocao da conexao e `Desconectar` no painel do
node registram a alteracao no historico de undo/redo e marcam o rascunho como
alterado.

## Exclusao segura de automacoes

`Excluir automacao` usa o status existente `archived`. Nenhuma linha e
apagada: versoes, auditoria, execucoes e jobs permanecem disponiveis para
consulta. Automacoes arquivadas deixam de aparecer na listagem padrao.

O backend continua exigindo propriedade da automacao e permissao comercial de
administrador para a operacao. O matcher considera apenas automacoes ativas,
entao novos eventos nao criam execucoes para uma automacao arquivada. Jobs ja
criados continuam sendo processados conforme a politica atual do engine; o
arquivamento nao cancela historico nem altera jobs existentes.
