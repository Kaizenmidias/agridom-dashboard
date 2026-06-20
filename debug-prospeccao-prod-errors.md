[OPEN] Debug session: prospection-prod-errors

## Sintoma
- Em produção, a prospecção mostra que o Apify não está configurado.
- Ao buscar leads, não retorna resultados úteis.
- O usuário quer mensagens explícitas de sucesso e falha na ferramenta de prospecção.
- Há erros adicionais em produção ao buscar usuários (`500` e `404`).

## Escopo
- Validar API de usuários em produção.
- Validar bootstrap/configuração do módulo de prospecção.
- Validar persistência e leitura das integrações, em especial Apify.
- Garantir feedback claro no front para sucesso e falha de busca.

## Hipóteses iniciais
1. A API de usuários em produção ainda está sem handler serverless dedicado, causando `404/500`.
2. A API de prospecção em produção não está lendo `system_settings` corretamente para marcar Apify como configurado.
3. A busca de leads está falhando no backend e o front não exibe a mensagem retornada de erro/sucesso.
4. O token de autenticação chega ao front, mas algum endpoint específico da prospecção está retornando erro silencioso e a UI fica sem feedback útil.
5. A integração do Apify foi salva, porém a leitura do status no bootstrap usa outra fonte/configuração e por isso a badge continua errada.

## Evidências coletadas
- Pendente.

## Próximos passos
- Instrumentar logs mínimos nos clientes de API do front para capturar status e payload dos erros de usuários e prospecção.
- Confirmar respostas reais dos endpoints de produção.
- Corrigir a origem da configuração do Apify e o feedback visual da busca.
