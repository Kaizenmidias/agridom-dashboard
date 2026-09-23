const FIELDS = Object.freeze(new Set(['status', 'pipeline', 'pipeline_stage', 'assigned_user', 'origin', 'source', 'phone', 'email', 'website']));
const OPERATORS = Object.freeze(new Set(['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty', 'has_label', 'does_not_have_label']));

const normalized = (value) => String(value ?? '').trim().toLowerCase();

function compare(value, operator, expected, labels = []) {
  const text = normalized(value);
  const target = normalized(expected);
  if (operator === 'is_empty') return text === '';
  if (operator === 'is_not_empty') return text !== '';
  if (operator === 'equals') return text === target;
  if (operator === 'not_equals') return text !== target;
  if (operator === 'contains') return text.includes(target);
  if (operator === 'not_contains') return !text.includes(target);
  if (operator === 'has_label') return labels.some((label) => normalized(label.name) === target || String(label.id) === String(expected));
  if (operator === 'does_not_have_label') return !labels.some((label) => normalized(label.name) === target || String(label.id) === String(expected));
  throw new Error(`INVALID_CONDITION_OPERATOR:${operator}`);
}

async function evaluateCondition(connection, config, { leadId, ownerUserId }) {
  const field = String(config?.field || '').trim();
  const operator = String(config?.operator || '').trim();
  if (!FIELDS.has(field) && !['label'].includes(field)) throw new Error(`INVALID_CONDITION_FIELD:${field}`);
  if (!OPERATORS.has(operator)) throw new Error(`INVALID_CONDITION_OPERATOR:${operator}`);
  if (field === 'label' && !['has_label', 'does_not_have_label'].includes(operator)) throw new Error(`INVALID_CONDITION_OPERATOR:${operator}`);
  const [leadRows] = await connection.execute(
    `SELECT p.*, pp.pipeline_id, pp.stage_id, ps.name AS stage_name, pd.name AS pipeline_name, u.name AS assignee_name
     FROM prospects p
     LEFT JOIN prospect_pipeline_positions pp ON pp.prospect_id = p.id
     LEFT JOIN pipeline_stages ps ON ps.id = pp.stage_id
     LEFT JOIN pipeline_definitions pd ON pd.id = pp.pipeline_id
     LEFT JOIN users u ON u.id = p.assigned_user_id
     WHERE p.id = ? AND p.owner_user_id = ? LIMIT 1`,
    [leadId, ownerUserId]
  );
  const lead = leadRows[0];
  if (!lead) throw new Error('LEAD_NOT_FOUND');
  const [labels] = await connection.execute('SELECT ll.id, ll.name FROM prospect_labels pl JOIN lead_labels ll ON ll.id = pl.label_id WHERE pl.prospect_id = ? AND ll.owner_user_id = ?', [leadId, ownerUserId]);
  const values = { status: lead.status, pipeline: lead.pipeline_name, pipeline_stage: lead.stage_name, assigned_user: lead.assignee_name, origin: lead.origin, source: lead.source, phone: lead.phone, email: lead.email, website: lead.website, label: labels };
  return { result: compare(values[field], operator, config?.value, labels), field, operator, value: config?.value ?? null };
}

module.exports = { FIELDS, OPERATORS, evaluateCondition };
