# Fase 2A - Implantacao

## Ordem obrigatoria

O backend desta fase consulta as novas tabelas no bootstrap de Leads. A migration deve ser aplicada antes de reiniciar a API com o novo codigo.

```bash
git pull origin main
mysql -u SEU_USUARIO -p kaizen_crm < database/migrations/20260922_phase_2a_commercial_entities.sql
npm install
npm run build
cd server
npm install
pm2 restart all
```

Antes da aplicacao, revise o arquivo SQL e faca backup do banco. A migration nao remove tabelas, colunas, JSON legado ou registros existentes.

## Migracao de dados legados

- Etiquetas em `analysis_report.labels`: backfill automatico para `lead_labels` e `prospect_labels`. O JSON antigo e preservado.
- Responsavel em `analysis_report.assignedTo`: backfill somente quando nome ou e-mail encontra exatamente um usuario ativo ou inativo. Valores ambiguos permanecem apenas no JSON.
- Pipeline no navegador: o frontend autenticado importa uma vez as colunas e posicoes encontradas no `localStorage`. As chaves antigas so sao removidas apos resposta bem-sucedida da API.
- Catalogo local de etiquetas: o `LeadLabelPicker` importa uma vez as etiquetas ainda inexistentes e remove a chave local somente apos sucesso.

Dados locais existem por navegador e perfil. Para importar Pipelines antigas de mais de um navegador, abra `/comercial/pipeline` uma vez em cada navegador depois da migration e do deploy.

## Verificacao

```sql
SELECT COUNT(*) FROM pipeline_definitions;
SELECT COUNT(*) FROM pipeline_stages;
SELECT COUNT(*) FROM prospect_pipeline_positions;
SELECT COUNT(*) FROM lead_labels;
SELECT COUNT(*) FROM prospect_labels;
SELECT COUNT(*) FROM lead_activities;
SELECT COUNT(*) FROM internal_notifications;
SELECT COUNT(*) FROM prospects WHERE assigned_user_id IS NOT NULL;
```

O arquivo `analysis_report` nao deve ser apagado nesta fase. Sua remocao futura depende de validacao dos backfills em producao.

## Consolidacao 2A.1

A Fase 2A.1 nao adiciona migration. Depois que a migration da Fase 2A estiver aplicada, atualize o codigo e o processo com:

```bash
cd /var/www/crm.kaizenmidias.com
git pull origin main
npm ci
npm run build
cd server
npm ci --omit=dev
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
pm2 status kaizen-crm-api
curl -fsS https://crm.kaizenmidias.com/api/health
```

O `NODE_ENV=production` fica em `server/ecosystem.config.cjs`, no ambiente do processo Node. Nao adicione `NODE_ENV` aos arquivos `.env` consumidos pelo Vite.

Antes do `startOrReload`, confira `pm2 list`. Se a API atual estiver registrada com outro nome e usando a mesma porta, remova ou pare apenas esse processo antigo para evitar duas instancias concorrendo pela porta. Nao use `pm2 restart all` em servidores que hospedam outros sistemas.

A origem oficial liberada pelo CORS e `https://crm.kaizenmidias.com`. A origem legada `https://agridom-dashboard.vercel.app` permanece bloqueada.
