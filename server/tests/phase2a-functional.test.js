const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const commercialRoute = read('server', 'routes', 'commercial-entities.js');
const prospectionRoute = read('server', 'routes', 'prospection.js');
const pipelinePage = read('src', 'pages', 'commercial', 'PipelinePage.tsx');
const leadAdapter = read('src', 'services', 'leads', 'lead-adapter.ts');
const notificationHook = read('src', 'hooks', 'use-notifications.ts');
const authRoute = read('server', 'routes', 'auth.js');

test('Pipeline usa tabelas relacionais e persiste criacao, etapas e movimento', () => {
  assert.match(commercialRoute, /router\.post\('\/pipelines'/);
  assert.match(commercialRoute, /INSERT INTO pipeline_definitions/);
  assert.match(commercialRoute, /router\.post\('\/pipelines\/:pipelineId\/stages'/);
  assert.match(commercialRoute, /INSERT INTO pipeline_stages/);
  assert.match(commercialRoute, /router\.patch\('\/pipeline-stages\/:stageId'/);
  assert.match(commercialRoute, /router\.delete\('\/pipeline-stages\/:stageId'/);
  assert.match(commercialRoute, /prospect_pipeline_positions/);
  assert.match(commercialRoute, /entered_stage_at = IF\(stage_id <> VALUES\(stage_id\), CURRENT_TIMESTAMP, entered_stage_at\), stage_id = VALUES\(stage_id\)/);
  assert.match(commercialRoute, /Pipeline precisa manter pelo menos uma etapa/);
  assert.match(commercialRoute, /Mova os Leads desta etapa antes de remove-la/);
});

test('Pipeline rejeita IDs invalidos e limita recursos ao proprietario autenticado', () => {
  assert.match(commercialRoute, /const parseId =/);
  assert.match(commercialRoute, /owner_user_id = \?/);
  assert.match(commercialRoute, /Pipeline, etapa ou Lead invalido/);
  assert.match(commercialRoute, /SELECT id FROM prospects WHERE id = \? AND owner_user_id = \?/);
});

test('importacao legada e idempotente e so limpa localStorage apos confirmacao', () => {
  assert.match(commercialRoute, /ON DUPLICATE KEY UPDATE stage_id = VALUES\(stage_id\), sort_order = VALUES\(sort_order\)/);
  assert.match(commercialRoute, /confirmed: true/);
  const confirmationIndex = pipelinePage.indexOf('if (!confirmation.confirmed)');
  const removalIndex = pipelinePage.indexOf('localStorage.removeItem(LEGACY_LEADS_KEY)');
  assert.ok(confirmationIndex >= 0 && removalIndex > confirmationIndex);
});

test('etiquetas usam lead_labels e prospect_labels sem analysis_report como fonte oficial', () => {
  assert.match(commercialRoute, /SELECT \* FROM lead_labels WHERE owner_user_id = \?/);
  assert.match(commercialRoute, /ON DUPLICATE KEY UPDATE color = VALUES\(color\)/);
  assert.match(commercialRoute, /UPDATE lead_labels SET name = COALESCE/);
  assert.match(commercialRoute, /DELETE FROM prospect_labels WHERE prospect_id = \?/);
  assert.match(commercialRoute, /INSERT INTO prospect_labels/);
  assert.match(prospectionRoute, /labels: labelsByProspect/);
  assert.match(leadAdapter, /normalizeLabels\(prospect\.labels\)/);
  assert.doesNotMatch(leadAdapter, /report\.labels/);
});

test('responsavel usa assigned_user_id, aceita NULL e valida usuario elegivel', () => {
  assert.match(prospectionRoute, /assigned_user_id = IF\(\?, \?, assigned_user_id\)/);
  assert.match(prospectionRoute, /hasOwnProperty\.call\(req\.body \|\| \{\}, 'assigned_user_id'\)/);
  assert.match(prospectionRoute, /validateAssignedUser/);
  assert.match(prospectionRoute, /is_active = 1/);
  assert.match(prospectionRoute, /can_access_crm = 1/);
  assert.match(leadAdapter, /assignedTo: prospect\.assigned_user_name \|\| null/);
  assert.doesNotMatch(leadAdapter, /report\.assignedTo/);
});

test('atividades persistem tipo, prazo, responsavel, status e conclusao', () => {
  assert.match(commercialRoute, /INSERT INTO lead_activities \(prospect_id, type, title, description, assigned_user_id, due_at, created_by\)/);
  assert.match(commercialRoute, /allowedTypes = \['task', 'call', 'follow_up', 'activity'\]/);
  assert.match(commercialRoute, /Responsavel inexistente, inativo ou sem acesso ao CRM/);
  assert.match(commercialRoute, /status = COALESCE\(\?, status\)/);
  assert.match(commercialRoute, /completed_at = CASE WHEN \? = 'completed' THEN COALESCE\(completed_at, CURRENT_TIMESTAMP\)/);
  assert.match(commercialRoute, /p\.owner_user_id = \?/);
});

test('notificacoes persistem e sao isoladas pelo usuario autenticado', () => {
  assert.match(commercialRoute, /INSERT INTO internal_notifications \(user_id, type, title, message/);
  assert.match(commercialRoute, /WHERE user_id = \? ORDER BY created_at DESC/);
  assert.match(commercialRoute, /WHERE id = \? AND user_id = \?/);
  assert.match(commercialRoute, /DELETE FROM internal_notifications WHERE id = \? AND user_id = \?/);
  assert.match(notificationHook, /commercialEntitiesAPI\.getNotifications/);
  assert.doesNotMatch(notificationHook, /localStorage/);
});

test('endpoints comerciais exigem autenticacao, usuario ativo e acesso ao CRM', () => {
  assert.match(commercialRoute, /router\.use\(authenticateToken\)/);
  assert.match(commercialRoute, /router\.use\(requireCommercialAccess\)/);
  assert.match(commercialRoute, /router\.post\('\/pipelines', requireCommercialAdmin/);
  assert.match(commercialRoute, /router\.patch\('\/pipeline-stages\/:stageId', requireCommercialAdmin/);
  assert.match(prospectionRoute, /router\.use\(authenticateToken\)/);
  assert.match(prospectionRoute, /router\.use\(requireCommercialAccess\)/);
});

test('autenticacao nao registra Authorization header, JWT ou secret', () => {
  assert.doesNotMatch(authRoute, /Authorization header/);
  assert.doesNotMatch(authRoute, /Token extra/);
  assert.doesNotMatch(authRoute, /Verificando token com secret/);
  assert.doesNotMatch(authRoute, /Token decodificado/);
});

test('Fase 2A.1 nao inicia estruturas da Automation Engine', () => {
  const changedSources = [commercialRoute, prospectionRoute, pipelinePage, notificationHook].join('\n');
  for (const table of ['automation_versions', 'automation_runs', 'automation_run_steps', 'automation_jobs', 'automation_events', 'automation_audit_logs']) {
    assert.doesNotMatch(changedSources, new RegExp(table));
  }
});
