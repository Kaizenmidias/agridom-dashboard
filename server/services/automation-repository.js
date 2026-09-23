const { getPool } = require('../config/database');
const { validateAutomationDefinition } = require('./automation-definition-validator');

class AutomationError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const parseJson = (value, fallback = {}) => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
};

const auditMetadata = (metadata = {}) => JSON.stringify(metadata);

async function withTransaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function ownedAutomation(connection, automationId, userId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT a.*, av.version_number AS active_version_number
     FROM automations a
     LEFT JOIN automation_versions av ON av.id = a.active_version_id
     WHERE a.id = ? AND a.owner_user_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [automationId, userId]
  );
  return rows[0] || null;
}

async function writeAudit(connection, automationId, userId, action, metadata = {}) {
  await connection.execute(
    'INSERT INTO automation_audit_logs (automation_id, user_id, action, metadata) VALUES (?, ?, ?, ?)',
    [automationId, userId, action, auditMetadata(metadata)]
  );
}

async function createAutomation({ ownerUserId, userId, name, description, triggerType, definition }) {
  const validation = validateAutomationDefinition(definition, { requireSteps: false });
  if (!validation.valid) throw new AutomationError(400, 'Definition invalida.', validation.errors);
  if (validation.definition.trigger?.type !== triggerType) {
    throw new AutomationError(400, 'Trigger da definition deve ser igual ao trigger_type da automacao.');
  }
  if (String(name || '').trim().length > 150) throw new AutomationError(400, 'Nome da automacao deve ter no maximo 150 caracteres.');

  return withTransaction(async (connection) => {
    const [automationResult] = await connection.execute(
      `INSERT INTO automations (owner_user_id, name, description, status, trigger_type, created_by, updated_by)
       VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
      [ownerUserId, name, description || null, triggerType, userId, userId]
    );
    const automationId = automationResult.insertId;
    const [versionResult] = await connection.execute(
      `INSERT INTO automation_versions (automation_id, version_number, status, definition, created_by)
       VALUES (?, 1, 'draft', ?, ?)`,
      [automationId, JSON.stringify(validation.definition), userId]
    );
    await writeAudit(connection, automationId, userId, 'automation.created', { versionId: versionResult.insertId });
    await writeAudit(connection, automationId, userId, 'automation.version_created', { versionId: versionResult.insertId, versionNumber: 1 });
    return { automationId: Number(automationId), versionId: Number(versionResult.insertId) };
  });
}

async function listAutomations(userId) {
  const [rows] = await getPool().execute(
    `SELECT a.id, a.name, a.description, a.status, a.trigger_type, a.active_version_id,
            av.version_number AS active_version_number, a.created_at, a.updated_at,
            creator.name AS created_by_name
     FROM automations a
     LEFT JOIN automation_versions av ON av.id = a.active_version_id
     LEFT JOIN users creator ON creator.id = a.created_by
     WHERE a.owner_user_id = ?
     ORDER BY a.updated_at DESC, a.id DESC`,
    [userId]
  );
  return rows;
}

async function getAutomation(userId, automationId) {
  const [automationRows] = await getPool().execute(
    `SELECT a.*, av.version_number AS active_version_number, creator.name AS created_by_name,
            updater.name AS updated_by_name
     FROM automations a
     LEFT JOIN automation_versions av ON av.id = a.active_version_id
     LEFT JOIN users creator ON creator.id = a.created_by
     LEFT JOIN users updater ON updater.id = a.updated_by
     WHERE a.id = ? AND a.owner_user_id = ?`,
    [automationId, userId]
  );
  const automation = automationRows[0];
  if (!automation) return null;

  const [versions] = await getPool().execute(
    `SELECT av.*, creator.name AS created_by_name
     FROM automation_versions av
     LEFT JOIN users creator ON creator.id = av.created_by
     WHERE av.automation_id = ? ORDER BY av.version_number DESC`,
    [automationId]
  );
  const [auditLogs] = await getPool().execute(
    `SELECT aal.*, u.name AS user_name
     FROM automation_audit_logs aal
     LEFT JOIN users u ON u.id = aal.user_id
     WHERE aal.automation_id = ? ORDER BY aal.created_at DESC, aal.id DESC LIMIT 100`,
    [automationId]
  );
  return {
    ...automation,
    versions: versions.map((version) => ({ ...version, definition: parseJson(version.definition) })),
    auditLogs: auditLogs.map((log) => ({ ...log, metadata: parseJson(log.metadata) })),
  };
}

async function getVersion(userId, automationId, versionId) {
  const [rows] = await getPool().execute(
    `SELECT av.*, a.name AS automation_name, a.owner_user_id, creator.name AS created_by_name
     FROM automation_versions av
     JOIN automations a ON a.id = av.automation_id
     LEFT JOIN users creator ON creator.id = av.created_by
     WHERE av.id = ? AND av.automation_id = ? AND a.owner_user_id = ?`,
    [versionId, automationId, userId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], definition: parseJson(rows[0].definition) };
}

async function updateAutomation(userId, automationId, values) {
  return withTransaction(async (connection) => {
    const automation = await ownedAutomation(connection, automationId, userId, true);
    if (!automation) throw new AutomationError(404, 'Automacao nao encontrada.');
    if (automation.status === 'archived') throw new AutomationError(409, 'Automacao arquivada nao pode ser editada.');

    const fields = [];
    const params = [];
    if (values.name !== undefined) {
      const name = String(values.name || '').trim();
      if (!name) throw new AutomationError(400, 'Nome da automacao e obrigatorio.');
      fields.push('name = ?');
      params.push(name);
    }
    if (values.description !== undefined) {
      fields.push('description = ?');
      params.push(values.description ? String(values.description).trim() : null);
    }
    if (values.trigger_type !== undefined) {
      fields.push('trigger_type = ?');
      params.push(values.trigger_type);
    }
    if (!fields.length) return automation;
    fields.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP');
    params.push(userId, automationId, userId);
    await connection.execute(`UPDATE automations SET ${fields.join(', ')} WHERE id = ? AND owner_user_id = ?`, params);
    await writeAudit(connection, automationId, userId, 'automation.updated', { fields: fields.map((field) => field.split(' ')[0]) });
    return { ...automation, ...values, updated_by: userId };
  });
}

async function createVersion(userId, automationId, definition) {
  const validation = validateAutomationDefinition(definition, { requireSteps: false });
  if (!validation.valid) throw new AutomationError(400, 'Definition invalida.', validation.errors);

  return withTransaction(async (connection) => {
    const automation = await ownedAutomation(connection, automationId, userId, true);
    if (!automation) throw new AutomationError(404, 'Automacao nao encontrada.');
    if (automation.status === 'archived') throw new AutomationError(409, 'Automacao arquivada nao aceita novas versoes.');
    if (validation.definition.trigger?.type !== automation.trigger_type) {
      throw new AutomationError(400, 'Trigger da definition deve ser igual ao trigger_type da automacao.');
    }
    const [drafts] = await connection.execute(
      "SELECT id, version_number FROM automation_versions WHERE automation_id = ? AND status = 'draft' LIMIT 1 FOR UPDATE",
      [automationId]
    );
    if (drafts.length) throw new AutomationError(409, 'Ja existe um rascunho para esta automacao.', [{ versionId: drafts[0].id, versionNumber: drafts[0].version_number }]);
    const [lastVersion] = await connection.execute('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM automation_versions WHERE automation_id = ?', [automationId]);
    const nextVersion = Number(lastVersion[0].next_version);
    const [versionResult] = await connection.execute(
      `INSERT INTO automation_versions (automation_id, version_number, status, definition, created_by)
       VALUES (?, ?, 'draft', ?, ?)`,
      [automationId, nextVersion, JSON.stringify(validation.definition), userId]
    );
    await connection.execute('UPDATE automations SET updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId, automationId]);
    await writeAudit(connection, automationId, userId, 'automation.version_created', { versionId: versionResult.insertId, versionNumber: nextVersion });
    return { id: Number(versionResult.insertId), automationId: Number(automationId), versionNumber: nextVersion, status: 'draft', definition: validation.definition };
  });
}

async function updateDraftVersion(userId, automationId, versionId, definition) {
  const validation = validateAutomationDefinition(definition, { requireSteps: false });
  if (!validation.valid) throw new AutomationError(400, 'Definition invalida.', validation.errors);

  return withTransaction(async (connection) => {
    const automation = await ownedAutomation(connection, automationId, userId, true);
    if (!automation) throw new AutomationError(404, 'Automacao nao encontrada.');
    if (automation.status === 'archived') throw new AutomationError(409, 'Automacao arquivada nao aceita edicao.');
    if (validation.definition.trigger?.type !== automation.trigger_type) {
      throw new AutomationError(400, 'Trigger da definition deve ser igual ao trigger_type da automacao.');
    }
    const [versions] = await connection.execute(
      "SELECT id, version_number, status FROM automation_versions WHERE id = ? AND automation_id = ? FOR UPDATE",
      [versionId, automationId]
    );
    const version = versions[0];
    if (!version) throw new AutomationError(404, 'Versao nao encontrada.');
    if (version.status !== 'draft') throw new AutomationError(409, 'Somente rascunhos podem ser editados.');
    await connection.execute('UPDATE automation_versions SET definition = ? WHERE id = ?', [JSON.stringify(validation.definition), versionId]);
    await connection.execute('UPDATE automations SET updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId, automationId]);
    await writeAudit(connection, automationId, userId, 'automation.version_updated', { versionId: Number(versionId), versionNumber: version.version_number });
    return { id: Number(versionId), automationId: Number(automationId), versionNumber: version.version_number, status: 'draft', definition: validation.definition };
  });
}

async function publishVersion(userId, automationId, versionId) {
  return withTransaction(async (connection) => {
    const automation = await ownedAutomation(connection, automationId, userId, true);
    if (!automation) throw new AutomationError(404, 'Automacao nao encontrada.');
    if (automation.status === 'archived') throw new AutomationError(409, 'Automacao arquivada nao pode ser publicada.');
    const [versions] = await connection.execute('SELECT * FROM automation_versions WHERE id = ? AND automation_id = ? FOR UPDATE', [versionId, automationId]);
    const version = versions[0];
    if (!version) throw new AutomationError(404, 'Versao nao encontrada.');
    if (version.status !== 'draft') throw new AutomationError(409, 'Somente rascunhos podem ser publicados.');
    const validation = validateAutomationDefinition(version.definition, { requireSteps: true, requireExecutableActions: true });
    if (!validation.valid) throw new AutomationError(400, 'Definition invalida para publicacao.', validation.errors);
    if (validation.definition.trigger?.type !== automation.trigger_type) {
      throw new AutomationError(400, 'Trigger da definition deve ser igual ao trigger_type da automacao.');
    }

    await connection.execute("UPDATE automation_versions SET status = 'superseded' WHERE automation_id = ? AND status = 'published'", [automationId]);
    await connection.execute("UPDATE automation_versions SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ?", [versionId]);
    await connection.execute("UPDATE automations SET active_version_id = ?, status = 'active', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [versionId, userId, automationId]);
    await writeAudit(connection, automationId, userId, 'automation.published', { versionId: Number(versionId), versionNumber: version.version_number });
    return { ...automation, active_version_id: Number(versionId), active_version_number: version.version_number, status: 'active' };
  });
}

async function transitionAutomation(userId, automationId, transition) {
  return withTransaction(async (connection) => {
    const automation = await ownedAutomation(connection, automationId, userId, true);
    if (!automation) throw new AutomationError(404, 'Automacao nao encontrada.');

    if (transition === 'pause') {
      if (automation.status === 'paused') return automation;
      if (automation.status !== 'active') throw new AutomationError(409, 'Somente automacoes ativas podem ser pausadas.');
      await connection.execute("UPDATE automations SET status = 'paused', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [userId, automationId]);
      await writeAudit(connection, automationId, userId, 'automation.paused');
      return { ...automation, status: 'paused' };
    }

    if (transition === 'activate') {
      if (automation.status === 'active') return automation;
      if (automation.status === 'archived') throw new AutomationError(409, 'Automacao arquivada nao pode ser ativada.');
      if (!automation.active_version_id || !automation.active_version_number) throw new AutomationError(409, 'A automacao precisa de uma versao publicada para ser ativada.');
      await connection.execute("UPDATE automations SET status = 'active', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [userId, automationId]);
      await writeAudit(connection, automationId, userId, 'automation.activated', { versionId: automation.active_version_id });
      return { ...automation, status: 'active' };
    }

    if (transition === 'archive') {
      if (automation.status === 'archived') return automation;
      await connection.execute("UPDATE automations SET status = 'archived', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [userId, automationId]);
      await writeAudit(connection, automationId, userId, 'automation.archived');
      return { ...automation, status: 'archived' };
    }

    throw new AutomationError(400, 'Transicao desconhecida.');
  });
}

async function listRuns(userId, automationId) {
  const [rows] = await getPool().execute(
    `SELECT ar.* FROM automation_runs ar
     JOIN automations a ON a.id = ar.automation_id
     WHERE ar.automation_id = ? AND a.owner_user_id = ?
     ORDER BY ar.created_at DESC, ar.id DESC`,
    [automationId, userId]
  );
  return rows;
}

async function listAllRuns({ page = 1, pageSize = 25 } = {}) {
  const safePage = Number.isSafeInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const safePageSize = Number.isSafeInteger(Number(pageSize)) && Number(pageSize) > 0 ? Math.min(Number(pageSize), 100) : 25;
  const offset = (safePage - 1) * safePageSize;
  const [countRows] = await getPool().execute('SELECT COUNT(*) AS total FROM automation_runs');
  const [rows] = await getPool().execute(
    `SELECT ar.id, ar.automation_id, ar.automation_version_id, ar.event_id, ar.entity_type, ar.entity_id,
            ar.status, ar.started_at, ar.finished_at, ar.correlation_id, ar.created_at, ar.updated_at,
            a.name AS automation_name, av.version_number, ae.event_type
     FROM automation_runs ar
     JOIN automations a ON a.id = ar.automation_id
     JOIN automation_versions av ON av.id = ar.automation_version_id
     LEFT JOIN automation_events ae ON ae.id = ar.event_id
     ORDER BY ar.created_at DESC, ar.id DESC LIMIT ? OFFSET ?`,
    [safePageSize, offset]
  );
  return { runs: rows, pagination: { page: safePage, pageSize: safePageSize, total: Number(countRows[0]?.total || 0), totalPages: Math.ceil(Number(countRows[0]?.total || 0) / safePageSize) } };
}

async function getRun(userId, runId) {
  const [runs] = await getPool().execute(
    `SELECT ar.*, a.name AS automation_name
     FROM automation_runs ar JOIN automations a ON a.id = ar.automation_id
     WHERE ar.id = ? AND a.owner_user_id = ?`,
    [runId, userId]
  );
  if (!runs[0]) return null;
  const [steps] = await getPool().execute('SELECT * FROM automation_run_steps WHERE automation_run_id = ? ORDER BY id', [runId]);
  const [jobs] = await getPool().execute('SELECT * FROM automation_jobs WHERE automation_run_id = ? ORDER BY id', [runId]);
  return { ...runs[0], steps, jobs };
}

module.exports = {
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
};
