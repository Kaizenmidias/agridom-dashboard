const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess, requireCommercialAdmin } = require('../middleware/commercial-access');
const { query } = require('../config/database');
const { runProvider, listModels } = require('../services/ai-provider');

const router = express.Router();
router.use(authenticateToken, requireCommercialAccess);

const idOf = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const clean = (value, max = 100000) => String(value || '').trim().slice(0, max);
const jsonObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

async function audit(agentId, actorUserId, action, metadata = {}) {
  await query('INSERT INTO ai_agent_audit (agent_id, actor_user_id, action, metadata) VALUES (?, ?, ?, ?)', [agentId || null, actorUserId || null, action, JSON.stringify(metadata)]);
}

async function getAgent(agentId, includePrompt = true) {
  const rows = await query(`SELECT a.*, COALESCE(SUM(u.total_tokens), 0) AS total_tokens, COUNT(DISTINCT u.id) AS usage_count
    FROM ai_agents a LEFT JOIN ai_agent_usage u ON u.agent_id = a.id
    WHERE a.id = ? GROUP BY a.id`, [agentId]);
  if (!rows[0]) return null;
  const agent = { ...rows[0], model_config: rows[0].model_config ? JSON.parse(rows[0].model_config) : {}, total_tokens: Number(rows[0].total_tokens), usage_count: Number(rows[0].usage_count) };
  if (!includePrompt) delete agent.system_prompt;
  const permissions = await query('SELECT permission_key, enabled FROM ai_agent_permissions WHERE agent_id = ? ORDER BY permission_key', [agentId]);
  const bindings = await query(`SELECT b.id, b.mode, b.status, b.communication_account_id, c.display_name, c.phone_number, c.status AS account_status
    FROM ai_agent_channel_bindings b JOIN communication_accounts c ON c.id = b.communication_account_id WHERE b.agent_id = ? ORDER BY b.id`, [agentId]);
  return { ...agent, permissions, bindings };
}

router.get('/', async (req, res) => {
  try {
    const search = clean(req.query.search, 191);
    const status = clean(req.query.status, 20);
    const params = [];
    let where = 'WHERE 1=1';
    if (search) { where += ' AND (a.name LIKE ? OR a.slug LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (['draft', 'active', 'inactive', 'archived'].includes(status)) { where += ' AND a.status = ?'; params.push(status); }
    const rows = await query(`SELECT a.id, a.name, a.slug, a.description, a.role, a.provider, a.model, a.status, a.monthly_token_limit, a.token_limit_policy, a.created_at, a.updated_at,
      COALESCE(SUM(CASE WHEN u.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') THEN u.total_tokens ELSE 0 END), 0) AS monthly_tokens,
      COUNT(DISTINCT b.id) AS binding_count
      FROM ai_agents a LEFT JOIN ai_agent_usage u ON u.agent_id = a.id LEFT JOIN ai_agent_channel_bindings b ON b.agent_id = a.id ${where} GROUP BY a.id ORDER BY a.updated_at DESC`, params);
    res.json({ agents: rows.map((row) => ({ ...row, monthly_tokens: Number(row.monthly_tokens), binding_count: Number(row.binding_count) })) });
  } catch (error) { console.error('Erro ao listar agentes:', error); res.status(500).json({ error: 'Nao foi possivel listar os agentes.' }); }
});

router.get('/:id', async (req, res) => {
  const agentId = idOf(req.params.id);
  if (!agentId) return res.status(400).json({ error: 'Agente invalido.' });
  try { const agent = await getAgent(agentId); if (!agent) return res.status(404).json({ error: 'Agente nao encontrado.' }); res.json({ agent }); }
  catch (error) { console.error('Erro ao carregar agente:', error); res.status(500).json({ error: 'Nao foi possivel carregar o agente.' }); }
});

router.post('/', requireCommercialAdmin, async (req, res) => {
  const name = clean(req.body?.name, 191); const prompt = clean(req.body?.system_prompt); const model = clean(req.body?.model, 120) || 'gpt-4o-mini';
  if (!name || !prompt) return res.status(400).json({ error: 'Nome e instrucoes do agente sao obrigatorios.' });
  try {
    if (!['openai', 'gemini'].includes(clean(req.body?.provider, 80)) || !clean(req.body?.model, 120)) return res.status(400).json({ error: 'Selecione um provedor e modelo validos.' });
    const availableModels = await listModels(clean(req.body.provider, 80));
    if (!availableModels.some((availableModel) => availableModel.id === model)) return res.status(400).json({ error: 'O modelo selecionado nao esta disponivel no provedor.' });
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agente'}-${Date.now()}`;
    const result = await query(`INSERT INTO ai_agents (name, slug, description, role, system_prompt, provider, model, model_config, status, monthly_token_limit, token_limit_policy, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`, [name, slug, clean(req.body?.description, 1000) || null, clean(req.body?.role, 191) || null, prompt, clean(req.body?.provider, 80) || 'openai', model, JSON.stringify(jsonObject(req.body?.model_config)), req.body?.monthly_token_limit || null, req.body?.token_limit_policy === 'block' ? 'block' : 'warn', req.userId]);
    const agentId = result.insertId;
    await savePermissions(agentId, req.body?.permissions);
    await audit(agentId, req.userId, 'created');
    res.status(201).json({ agent: await getAgent(agentId) });
  } catch (error) { console.error('Erro ao criar agente:', error); res.status(500).json({ error: 'Nao foi possivel criar o agente.' }); }
});

async function savePermissions(agentId, permissions) {
  if (!Array.isArray(permissions)) return;
  for (const permission of permissions) {
    const key = clean(permission?.permission_key, 120); if (!key) continue;
    await query(`INSERT INTO ai_agent_permissions (agent_id, permission_key, enabled) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`, [agentId, key, permission.enabled ? 1 : 0]);
  }
}

router.patch('/:id', requireCommercialAdmin, async (req, res) => {
  const agentId = idOf(req.params.id); if (!agentId) return res.status(400).json({ error: 'Agente invalido.' });
  const fields = []; const values = [];
  for (const [field, max] of [['name', 191], ['description', 1000], ['role', 191], ['system_prompt', 100000], ['provider', 80], ['model', 120]]) if (req.body?.[field] !== undefined) { fields.push(`${field} = ?`); values.push(clean(req.body[field], max)); }
  if (req.body?.model_config !== undefined) { fields.push('model_config = ?'); values.push(JSON.stringify(jsonObject(req.body.model_config))); }
  if (req.body?.monthly_token_limit !== undefined) { fields.push('monthly_token_limit = ?'); values.push(req.body.monthly_token_limit || null); }
  if (req.body?.token_limit_policy !== undefined) { fields.push('token_limit_policy = ?'); values.push(req.body.token_limit_policy === 'block' ? 'block' : 'warn'); }
  try { if (fields.length) { values.push(agentId); await query(`UPDATE ai_agents SET ${fields.join(', ')} WHERE id = ?`, values); } await savePermissions(agentId, req.body?.permissions); await audit(agentId, req.userId, 'updated'); const agent = await getAgent(agentId); if (!agent) return res.status(404).json({ error: 'Agente nao encontrado.' }); res.json({ agent }); }
  catch (error) { console.error('Erro ao atualizar agente:', error); res.status(500).json({ error: 'Nao foi possivel atualizar o agente.' }); }
});

router.post('/:id/duplicate', requireCommercialAdmin, async (req, res) => {
  const agentId = idOf(req.params.id); if (!agentId) return res.status(400).json({ error: 'Agente invalido.' });
  try { const source = await getAgent(agentId); if (!source) return res.status(404).json({ error: 'Agente nao encontrado.' }); const result = await query(`INSERT INTO ai_agents (name, slug, description, role, system_prompt, provider, model, model_config, status, monthly_token_limit, token_limit_policy, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`, [`${source.name} - copia`, `${source.slug}-copy-${Date.now()}`, source.description, source.role, source.system_prompt, source.provider, source.model, JSON.stringify(source.model_config), source.monthly_token_limit, source.token_limit_policy, req.userId]); await savePermissions(result.insertId, source.permissions); await audit(result.insertId, req.userId, 'duplicated', { sourceAgentId: agentId }); res.status(201).json({ agent: await getAgent(result.insertId) }); }
  catch (error) { console.error('Erro ao duplicar agente:', error); res.status(500).json({ error: 'Nao foi possivel duplicar o agente.' }); }
});

router.post('/:id/status', requireCommercialAdmin, async (req, res) => { const agentId = idOf(req.params.id); const status = clean(req.body?.status, 20); if (!agentId || !['draft', 'active', 'inactive', 'archived'].includes(status)) return res.status(400).json({ error: 'Status invalido.' }); try { await query('UPDATE ai_agents SET status = ?, archived_at = ? WHERE id = ?', [status, status === 'archived' ? new Date() : null, agentId]); await audit(agentId, req.userId, `status_${status}`); res.json({ agent: await getAgent(agentId) }); } catch (error) { res.status(500).json({ error: 'Nao foi possivel alterar o status.' }); } });
router.delete('/:id', requireCommercialAdmin, async (req, res) => { const agentId = idOf(req.params.id); if (!agentId) return res.status(400).json({ error: 'Agente invalido.' }); try { await query("UPDATE ai_agents SET status = 'archived', archived_at = CURRENT_TIMESTAMP WHERE id = ?", [agentId]); await audit(agentId, req.userId, 'archived'); res.json({ archived: true }); } catch (error) { res.status(500).json({ error: 'Nao foi possivel arquivar o agente.' }); } });

router.get('/:id/usage', async (req, res) => { const agentId = idOf(req.params.id); const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100); try { const rows = await query('SELECT id, provider, model, operation, origin, input_tokens, output_tokens, total_tokens, cost_amount, cost_currency, created_at FROM ai_agent_usage WHERE agent_id = ? ORDER BY id DESC LIMIT ?', [agentId, limit]); res.json({ usage: rows }); } catch (error) { res.status(500).json({ error: 'Nao foi possivel carregar o uso do agente.' }); } });

router.post('/:id/test', async (req, res) => {
  const agentId = idOf(req.params.id); if (!agentId) return res.status(400).json({ error: 'Agente invalido.' });
  try {
    const agent = await getAgent(agentId); if (!agent) return res.status(404).json({ error: 'Agente nao encontrado.' });
    const messages = Array.isArray(req.body?.messages) ? req.body.messages.filter((message) => ['user', 'assistant'].includes(message?.role)).slice(-20).map((message) => ({ role: message.role, content: clean(message.content, 10000) })) : [];
    const monthly = await query("SELECT COALESCE(SUM(total_tokens), 0) AS total FROM ai_agent_usage WHERE agent_id = ? AND created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')", [agentId]);
    if (agent.token_limit_policy === 'block' && agent.monthly_token_limit && Number(monthly[0].total) >= Number(agent.monthly_token_limit)) return res.status(429).json({ error: 'Limite mensal de tokens atingido.', code: 'AI_TOKEN_LIMIT' });
    if (!['openai', 'gemini'].includes(agent.provider) || !agent.model) return res.status(409).json({ error: 'Selecione um provedor e modelo validos antes de testar.', code: 'AI_MODEL_INVALID' });
    const models = await listModels(agent.provider);
    if (!models.some((model) => model.id === agent.model)) return res.status(409).json({ error: 'O modelo deste agente nao esta mais disponivel no provedor.', code: 'AI_MODEL_UNAVAILABLE' });
    const result = await runProvider({ provider: agent.provider, model: agent.model, systemPrompt: agent.system_prompt, messages, modelConfig: agent.model_config });
    await query(`INSERT INTO ai_agent_usage (agent_id, provider, model, operation, origin, input_tokens, output_tokens, total_tokens, cost_amount, cost_currency, user_id) VALUES (?, ?, ?, 'playground', 'playground', ?, ?, ?, ?, ?, ?)`, [agentId, agent.provider, agent.model, result.inputTokens, result.outputTokens, result.totalTokens, result.costAmount, result.costAmount === null ? null : 'USD', req.userId]);
    await audit(agentId, req.userId, 'playground_test');
    res.json({ reply: result.content, usage: result });
  } catch (error) { const status = error.code === 'AI_TOKEN_LIMIT' ? 429 : error.code === 'AI_PROVIDER_NOT_CONFIGURED' ? 503 : 502; res.status(status).json({ error: error.message || 'Nao foi possivel testar o agente.', code: error.code || 'AI_PROVIDER_FAILED' }); }
});

module.exports = router;
