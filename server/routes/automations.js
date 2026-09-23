const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess, requireCommercialAdmin } = require('../middleware/commercial-access');
const { TRIGGER_TYPES } = require('../services/automation-catalog');
const { dryRunAutomation } = require('../services/automation/dry-run');
const {
  AutomationError,
  createAutomation,
  listAutomations,
  getAutomation,
  getVersion,
  updateAutomation,
  createVersion,
  updateDraftVersion,
  publishVersion,
  transitionAutomation,
  listRuns,
  listAllRuns,
  getRun,
} = require('../services/automation-repository');

const automationsRouter = express.Router();
const automationRunsRouter = express.Router();

const protect = [authenticateToken, requireCommercialAccess];
automationsRouter.use(...protect);
automationRunsRouter.use(...protect);

const parseId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const handleError = (res, error, fallback = 'Nao foi possivel concluir a operacao.') => {
  if (error instanceof AutomationError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }
  console.error('Erro na Automation Foundation:', error);
  return res.status(500).json({ error: fallback });
};

const defaultDefinition = (triggerType) => ({
  schemaVersion: 1,
  trigger: { type: triggerType, config: {} },
  steps: [],
});

automationRunsRouter.get('/', requireCommercialAdmin, async (req, res) => {
  try {
    res.json(await listAllRuns({ page: req.query.page, pageSize: req.query.page_size }));
  } catch (error) {
    handleError(res, error, 'Nao foi possivel listar as execucoes.');
  }
});

automationsRouter.get('/', async (req, res) => {
  try {
    const automations = await listAutomations(req.userId);
    res.json({ automations });
  } catch (error) {
    handleError(res, error, 'Nao foi possivel listar as automacoes.');
  }
});

automationsRouter.post('/', requireCommercialAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const triggerType = String(req.body?.trigger_type || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome da automacao e obrigatorio.' });
    if (!TRIGGER_TYPES.includes(triggerType)) return res.status(400).json({ error: 'Trigger nao reconhecido.' });
    const result = await createAutomation({
      ownerUserId: req.userId,
      userId: req.userId,
      name,
      description: req.body?.description,
      triggerType,
      definition: req.body?.definition || defaultDefinition(triggerType),
    });
    const automation = await getAutomation(req.userId, result.automationId);
    res.status(201).json(automation);
  } catch (error) {
    handleError(res, error, 'Nao foi possivel criar a automacao.');
  }
});

automationsRouter.get('/:id', async (req, res) => {
  const automationId = parseId(req.params.id);
  if (!automationId) return res.status(400).json({ error: 'ID da automacao invalido.' });
  try {
    const automation = await getAutomation(req.userId, automationId);
    if (!automation) return res.status(404).json({ error: 'Automacao nao encontrada.' });
    res.json(automation);
  } catch (error) {
    handleError(res, error, 'Nao foi possivel carregar a automacao.');
  }
});

automationsRouter.patch('/:id', requireCommercialAdmin, async (req, res) => {
  const automationId = parseId(req.params.id);
  if (!automationId) return res.status(400).json({ error: 'ID da automacao invalido.' });
  if (req.body?.definition !== undefined || req.body?.trigger_type !== undefined) {
    return res.status(400).json({ error: 'Definition e trigger devem ser alterados por uma nova versao.' });
  }
  try {
    await updateAutomation(req.userId, automationId, {
      name: req.body?.name,
      description: req.body?.description,
    });
    const automation = await getAutomation(req.userId, automationId);
    res.json(automation);
  } catch (error) {
    handleError(res, error, 'Nao foi possivel editar a automacao.');
  }
});

automationsRouter.get('/:id/versions', async (req, res) => {
  const automationId = parseId(req.params.id);
  if (!automationId) return res.status(400).json({ error: 'ID da automacao invalido.' });
  try {
    const automation = await getAutomation(req.userId, automationId);
    if (!automation) return res.status(404).json({ error: 'Automacao nao encontrada.' });
    res.json({ versions: automation.versions });
  } catch (error) {
    handleError(res, error, 'Nao foi possivel listar as versoes.');
  }
});

automationsRouter.post('/:id/versions', requireCommercialAdmin, async (req, res) => {
  const automationId = parseId(req.params.id);
  if (!automationId) return res.status(400).json({ error: 'ID da automacao invalido.' });
  if (req.body?.definition === undefined) return res.status(400).json({ error: 'Definition e obrigatoria.' });
  try {
    const version = await createVersion(req.userId, automationId, req.body.definition);
    res.status(201).json(version);
  } catch (error) {
    handleError(res, error, 'Nao foi possivel criar a versao.');
  }
});

automationsRouter.get('/:id/versions/:versionId', async (req, res) => {
  const automationId = parseId(req.params.id);
  const versionId = parseId(req.params.versionId);
  if (!automationId || !versionId) return res.status(400).json({ error: 'ID da automacao ou versao invalido.' });
  try {
    const version = await getVersion(req.userId, automationId, versionId);
    if (!version) return res.status(404).json({ error: 'Versao nao encontrada.' });
    res.json(version);
  } catch (error) {
    handleError(res, error, 'Nao foi possivel carregar a versao.');
  }
});

automationsRouter.patch('/:id/versions/:versionId', requireCommercialAdmin, async (req, res) => {
  const automationId = parseId(req.params.id);
  const versionId = parseId(req.params.versionId);
  if (!automationId || !versionId) return res.status(400).json({ error: 'ID da automacao ou versao invalido.' });
  if (req.body?.definition === undefined) return res.status(400).json({ error: 'Definition e obrigatoria.' });
  try {
    const version = await updateDraftVersion(req.userId, automationId, versionId, req.body.definition);
    res.json(version);
  } catch (error) {
    handleError(res, error, 'Nao foi possivel atualizar o rascunho.');
  }
});

automationsRouter.post('/:id/publish', requireCommercialAdmin, async (req, res) => {
  const automationId = parseId(req.params.id);
  const versionId = parseId(req.body?.version_id);
  if (!automationId || !versionId) return res.status(400).json({ error: 'ID da automacao ou versao invalido.' });
  try {
    const automation = await publishVersion(req.userId, automationId, versionId);
    res.json(automation);
  } catch (error) {
    handleError(res, error, 'Nao foi possivel publicar a automacao.');
  }
});

for (const [path, transition] of [['pause', 'pause'], ['activate', 'activate'], ['archive', 'archive']]) {
  automationsRouter.post(`/:id/${path}`, requireCommercialAdmin, async (req, res) => {
    const automationId = parseId(req.params.id);
    if (!automationId) return res.status(400).json({ error: 'ID da automacao invalido.' });
    try {
      const automation = await transitionAutomation(req.userId, automationId, transition);
      res.json(automation);
    } catch (error) {
      handleError(res, error, `Nao foi possivel ${path === 'pause' ? 'pausar' : path === 'activate' ? 'ativar' : 'arquivar'} a automacao.`);
    }
  });
}

automationsRouter.get('/:id/runs', async (req, res) => {
  const automationId = parseId(req.params.id);
  if (!automationId) return res.status(400).json({ error: 'ID da automacao invalido.' });
  try {
    const automation = await getAutomation(req.userId, automationId);
    if (!automation) return res.status(404).json({ error: 'Automacao nao encontrada.' });
    res.json({ runs: await listRuns(req.userId, automationId) });
  } catch (error) {
    handleError(res, error, 'Nao foi possivel listar as execucoes.');
  }
});

automationsRouter.post('/:id/dry-run', async (req, res) => {
  const automationId = parseId(req.params.id);
  const leadId = parseId(req.body?.lead_id);
  if (!automationId || !leadId) return res.status(400).json({ error: 'ID da automacao e do lead sao obrigatorios.' });
  try {
    const automation = await getAutomation(req.userId, automationId);
    if (!automation) return res.status(404).json({ error: 'Automacao nao encontrada.' });
    const definition = req.body?.definition || automation.versions.find((version) => version.status === 'draft')?.definition || automation.versions.find((version) => version.id === automation.active_version_id)?.definition;
    if (!definition) return res.status(400).json({ error: 'A automacao ainda nao possui uma definicao para testar.' });
    res.json(await dryRunAutomation({ definition, leadId, ownerUserId: req.userId }));
  } catch (error) {
    if (error.details) return res.status(400).json({ error: 'Definition invalida.', details: error.details });
    handleError(res, error, 'Nao foi possivel testar a automacao.');
  }
});

automationRunsRouter.get('/:runId', async (req, res) => {
  const runId = parseId(req.params.runId);
  if (!runId) return res.status(400).json({ error: 'ID da execucao invalido.' });
  try {
    const run = await getRun(req.userId, runId);
    if (!run) return res.status(404).json({ error: 'Execucao nao encontrada.' });
    res.json(run);
  } catch (error) {
    handleError(res, error, 'Nao foi possivel carregar a execucao.');
  }
});

module.exports = { automationsRouter, automationRunsRouter };
