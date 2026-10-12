const parseAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const calculateProjectBalance = (project) => Math.max(0, parseAmount(project.project_value) - parseAmount(project.paid_value));

async function ensureLegacyBaseline(connection, project) {
  const opening = parseAmount(project.paid_value);
  if (opening <= 0) return null;
  const [existing] = await connection.execute('SELECT * FROM project_financial_baselines WHERE project_id = ? FOR UPDATE', [project.id]);
  if (existing[0]) return existing[0];
  const [events] = await connection.execute('SELECT id FROM project_financial_events WHERE project_id = ? LIMIT 1 FOR UPDATE', [project.id]);
  if (events[0]) return null;
  const [result] = await connection.execute(
    `INSERT INTO project_financial_baselines (project_id, amount, competence_date, origin, idempotency_key)
     VALUES (?, ?, NULL, 'legacy_opening_balance', ?)`,
    [project.id, opening, `project:${project.id}:legacy-opening-balance`]
  );
  const [rows] = await connection.execute('SELECT * FROM project_financial_baselines WHERE id = ?', [result.insertId]);
  return rows[0] || null;
}

const financialEventMatches = (existing, event) => (
  Number(existing.project_id) === Number(event.projectId)
  && existing.event_type === event.eventType
  && Number(existing.amount) === Number(parseAmount(event.amount).toFixed(2))
  && (existing.competence_date || null) === (event.competenceDate || null)
  && existing.direction === (event.direction || 'credit')
  && existing.origin === event.origin
);

async function recordFinancialEvent(connection, event) {
  const amount = parseAmount(event.amount);
  if (amount <= 0) return null;

  const [existing] = await connection.execute('SELECT * FROM project_financial_events WHERE project_id = ? AND idempotency_key = ? FOR UPDATE', [event.projectId, event.idempotencyKey]);
  if (existing[0]) {
    if (!financialEventMatches(existing[0], event)) throw Object.assign(new Error('Idempotency key conflict'), { code: 'FINANCIAL_IDEMPOTENCY_CONFLICT' });
    return { event: existing[0], created: false };
  }

  const [result] = await connection.execute(
    `INSERT INTO project_financial_events
      (project_id, event_type, direction, amount, competence_date, origin, idempotency_key, reference_event_id, is_historical, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [event.projectId, event.eventType, event.direction || 'credit', amount, event.competenceDate || null, event.origin, event.idempotencyKey, event.referenceEventId || null, event.isHistorical ? 1 : 0, event.notes || null, event.createdBy || null]
  );
  const [rows] = await connection.execute('SELECT * FROM project_financial_events WHERE id = ?', [result.insertId]);
  return { event: rows[0] || null, created: true };
}

async function settleProjectOnCompletion({ connection, projectId, completionDate, createdBy = null }) {
  const [rows] = await connection.execute('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [projectId]);
  const project = rows[0];
  if (!project) return null;
  if (project.status === 'completed') return project;

  await ensureLegacyBaseline(connection, project);
  const balance = calculateProjectBalance(project);
  if (balance > 0) {
    await recordFinancialEvent(connection, {
      projectId,
      eventType: 'completion_settlement',
      amount: balance,
      competenceDate: completionDate,
      origin: 'completion',
      idempotencyKey: `project:${projectId}:completion-settlement`,
      createdBy,
    });
  }

  await connection.execute(`UPDATE projects SET status = 'completed', paid_value = project_value, completion_date = COALESCE(completion_date, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`, [completionDate, projectId]);
  const [updated] = await connection.execute('SELECT * FROM projects WHERE id = ?', [projectId]);
  return updated[0] || null;
}

async function recordProjectPayment({ connection, projectId, amount, competenceDate, createdBy = null, idempotencyKey }) {
  const [rows] = await connection.execute('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [projectId]);
  const project = rows[0];
  if (!project) return null;
  if (!idempotencyKey) throw Object.assign(new Error('Idempotency key is required'), { code: 'FINANCIAL_IDEMPOTENCY_REQUIRED' });
  const event = { projectId, eventType: 'payment_received', amount, competenceDate, origin: 'manual', idempotencyKey, createdBy };
  const [existing] = await connection.execute('SELECT * FROM project_financial_events WHERE project_id = ? AND idempotency_key = ? FOR UPDATE', [projectId, idempotencyKey]);
  if (existing[0]) {
    if (!financialEventMatches(existing[0], event)) throw Object.assign(new Error('Idempotency key conflict'), { code: 'FINANCIAL_IDEMPOTENCY_CONFLICT' });
    return project;
  }
  const payment = parseAmount(amount);
  if (payment <= 0 || payment > calculateProjectBalance(project)) throw Object.assign(new Error('Payment exceeds available balance'), { code: 'FINANCIAL_PAYMENT_EXCEEDS_BALANCE' });
  await ensureLegacyBaseline(connection, project);
  const recorded = await recordFinancialEvent(connection, { ...event, amount: payment });
  if (!recorded.created) return project;
  await connection.execute('UPDATE projects SET paid_value = paid_value + ? WHERE id = ?', [payment, projectId]);
  const [updated] = await connection.execute('SELECT * FROM projects WHERE id = ?', [projectId]);
  return updated[0] || null;
}

module.exports = { parseAmount, calculateProjectBalance, ensureLegacyBaseline, recordFinancialEvent, recordProjectPayment, settleProjectOnCompletion };
