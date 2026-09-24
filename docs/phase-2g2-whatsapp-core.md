# Fase 2G.2 - WhatsApp Core

## Arquitetura

O CRM conversa com a Evolution API somente pelo `EvolutionWhatsAppProvider`.
As rotas administrativas e de conversa usam o servico WhatsApp, e nenhuma
rota monta URLs da Evolution diretamente. A API esperada e a Evolution v2.x.

`communication_accounts` representa cada instancia/numeros, separado do
provider e do telefone. `conversations` e `communication_messages` formam a
base omnichannel: o canal atual e `whatsapp`, mas o schema aceita novos canais.

## Seguranca e configuracao

Administracao > Integracoes > WhatsApp salva a Base URL como HTTP/HTTPS e a
API Key cifrada com o AES-256-GCM da Fase 2G.1. A chave do CRM continua sendo
`INTEGRATION_ENCRYPTION_KEY`. A API Key nunca e devolvida ao frontend, gravada
em automation definitions ou colocada em URL/log.

Hosts privados nao sao bloqueados automaticamente porque a Evolution pode
estar na rede privada da VPS. Esquemas `file`, `ftp`, `gopher`, credenciais,
query strings e fragments sao rejeitados para reduzir SSRF.

## Contas, QR e status

Admins usam `/api/integrations/whatsapp` para configurar a Evolution, criar
instancias, obter QR, consultar estado, desconectar e arquivar. O frontend
consulta o backend e faz polling de status durante o QR; historico nao e
apagado ao desconectar/arquivar.

## Webhook e idempotencia

`POST /api/webhooks/evolution` nao usa sessao de usuario. Ele identifica a
instancia, valida o header `apikey`/`x-api-key` contra a API Key cifrada,
deduplica pelo ID externo da mensagem/evento e persiste um evento pendente.
Responde `202` antes do processamento pesado. O worker processa os eventos.

Mensagens de grupo, broadcast, status, newsletter, sem remetente ou sem ID
externo nao criam Leads. `fromMe` vira outbound e nunca cria Lead.

## Lead e conversa

O telefone e normalizado em uma funcao central, preservando o JID completo em
`external_sender_id`/`external_conversation_id`. O matching usa o Lead
existente; se a conta permitir, um contato desconhecido cria Lead com os
dados conhecidos, origem `WhatsApp` e evento `lead.created`. Um advisory lock
por telefone evita duplicacao concorrente.

## Envio

`POST /api/conversations/:id/messages` envia texto usando a conta da conversa.
O executor `whatsapp.send` resolve Lead, telefone, conta conectada e mensagem,
persiste outbound e usa a mesma idempotencia das automacoes. Conta ausente,
desconectada ou telefone ausente geram erros estruturados. O dry-run valida
conta, telefone e mensagem sem chamar a Evolution.

O provider nao faz retry cego de envio. Falhas retryable retornam ao retry
existente do worker; a garantia exactly-once depende da Evolution/WhatsApp.

## Agentes futuros

O webhook e as conversas deixam preparado `handling_mode` (`human`, `ai`,
`paused`) sem executar agente nesta fase. Agentes futuros devem usar uma Tool
Layer com schemas, autorizacao, auditoria, limites e idempotencia, passando por
Domain Services e Repositories. Nunca terao SQL, credenciais, shell ou eval.
Google Calendar, Instagram, LinkedIn e runtime LLM ficam para fases futuras.

## Migration e teste manual

Aplicar manualmente apenas:
`database/migrations/20260923_phase_2g2_whatsapp_core.sql`.
Ela e nova e nao altera a migration 2G.1; nao foi executada por este commit.

Depois de configurar `PUBLIC_API_URL` ou `BACKEND_URL`, criar a conta em
Administracao > Integracoes, escanear o QR, confirmar o status conectado,
enviar uma mensagem de `/comercial/chats` e receber uma mensagem real.
