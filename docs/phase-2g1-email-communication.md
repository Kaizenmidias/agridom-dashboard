# Fase 2G.1 - E-mail externo

## Arquitetura

O worker continua usando `automation_jobs`, `automation_runs` e o executor
existente. A action `email.send` resolve o lead e as variaveis permitidas,
passa pelo servico SMTP e usa Nodemailer. O engine nao conhece host, porta,
TLS ou credenciais.

## Integracao e secrets

Os dados nao sensiveis continuam em `integration_providers`. A senha SMTP fica
em `secret_ciphertext`, `secret_iv` e `secret_auth_tag`, protegida por AES-256-GCM
com a chave fornecida em `INTEGRATION_ENCRYPTION_KEY`. A chave nao e gravada no
banco nem no Git. Sem essa variavel o backend recusa salvar ou usar a senha.

A integracao aceita host, porta, seguranca `ssl`/`starttls`, usuario, senha,
nome do remetente, e-mail do remetente e reply-to. Host nao pode conter URL,
protocolo, barras ou CR/LF. Portas e enderecos sao validados.

## Endpoints

- `GET /api/integrations/email`
- `PUT /api/integrations/email`
- `POST /api/integrations/email/test-connection`
- `POST /api/integrations/email/test-send`

Todos exigem autenticacao, acesso comercial e administrador. Testes possuem
uma janela simples de rate limit de dez segundos por usuario e operacao.

## Executor e retries

O catalogo usa `email.send`. O destinatario padrao e `lead.email`; assunto,
mensagem e reply-to aceitam apenas o resolver allowlistado de variaveis. Lead
sem e-mail, integracao ausente e template invalido sao falhas definitivas.
Timeout, reset de conexao e SMTP 4xx podem usar o retry existente do worker.

## Idempotencia e log

`communication_messages` registra canal, direcao, lead, automacao, run, step,
destinatario, assunto, status, provider, message ID, tentativas e erro
sanitizado. A chave e `email:<automation job/step key>`, protegendo execucoes
concorrentes e evitando repeticao apos sucesso conhecido.

SMTP nao oferece exactly-once transacional: se o servidor aceitar a mensagem
e o processo morrer antes de gravar `sent`, ainda existe uma janela residual
de duplicidade em um retry posterior. O CRM reduz esse risco com lock,
idempotencia e estado persistente, mas nao declara garantia que SMTP nao pode
oferecer.

## Dry-run e historico

O dry-run resolve destinatario, assunto e mensagem, valida a integracao e
retorna o plano sem chamar `sendMail`. O envio confirmado grava uma entrada no
historico de contato do lead uma unica vez.

## Migration e teste manual

A migration incremental e
`database/migrations/20260923_phase_2g1_email_communication.sql`. Ela cria o
log e adiciona colunas de secret/teste em `integration_providers`; nao deve ser
executada automaticamente pelo deploy.

Depois de aplica-la e configurar `INTEGRATION_ENCRYPTION_KEY`, o administrador
deve salvar SMTP, testar conexao, enviar teste para um endereco controlado e
entao validar uma automacao `Lead criado -> Enviar e-mail` com um lead real.
