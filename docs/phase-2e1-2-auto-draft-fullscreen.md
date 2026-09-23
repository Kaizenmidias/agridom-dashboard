# Fase 2E.1.2: auto-draft e editor full-screen

O editor agora trata versionamento como detalhe interno. Quando existe apenas
uma versão publicada, o primeiro `Salvar` ou `Publicar` cria automaticamente
um novo draft com a definição atual do grafo. Quando já existe draft, ele é
atualizado. O backend continua protegendo versões publicadas contra alteração.

A criação usa o fluxo existente de `createVersion`. A linha da automação é
bloqueada na transação antes da verificação de draft, evitando drafts duplicados
quando duas requisições chegam simultaneamente.

O modo de edição ocupa a viewport e mostra somente toolbar, canvas e biblioteca
ou configuração do node. Versões, JSON, resumo, auditoria e execuções continuam
disponíveis no backend, mas não aparecem abaixo do editor principal.

O toolbar informa alterações não salvas e confirma a saída quando há mudanças
locais. O publish salva o snapshot atual antes de publicar, portanto não depende
de um clique anterior em salvar.
