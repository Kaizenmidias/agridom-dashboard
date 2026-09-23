const { dispatchDomainEvent } = require('../domain-events');
const { getActionDefinition, isExecutable } = require('./action-registry');
const { resolveConfig } = require('./variable-resolver');

const FIELD_ALLOWLIST = Object.freeze(new Set(['business_name', 'category', 'address', 'city', 'state', 'phone', 'email', 'website', 'status']));

async function ownedLead(connection, leadId, ownerUserId, lock = true) {
  const [rows] = await connection.execute(`SELECT * FROM prospects WHERE id = ? AND owner_user_id = ?${lock ? ' FOR UPDATE' : ''}`, [leadId, ownerUserId]);
  return rows[0] || null;
}

async function writeHistory(connection, leadId, ownerUserId, message, metadata) {
  await connection.execute('INSERT INTO prospect_contact_history (prospect_id, owner_user_id, channel, message, metadata) VALUES (?, ?, \'automation\', ?, ?)', [leadId, ownerUserId, message, JSON.stringify(metadata || {})]);
}

async function emit(connection, type, leadId, payload, context) {
  return dispatchDomainEvent({ type, entityType: 'lead', entityId: leadId, actorUserId: context.ownerUserId, payload, correlationId: context.correlationId, causationId: context.causationId, idempotencyKey: context.idempotencyKey, sourceAutomationId: context.automationId, lineageDepth: context.lineageDepth }, { connection });
}

async function executeAction(connection, actionType, rawConfig, context) {
  const definition = getActionDefinition(actionType);
  if (!definition) throw new Error(`UNKNOWN_ACTION_TYPE:${actionType}`);
  if (!isExecutable(actionType)) throw new Error(`ACTION_NOT_EXECUTABLE:${actionType}`);
  const lead = await ownedLead(connection, context.leadId, context.ownerUserId);
  if (!lead) throw new Error('LEAD_NOT_FOUND');
  const [ownerRows] = await connection.execute('SELECT id, name, email FROM users WHERE id = ?', [context.ownerUserId]);
  const [assigneeRows] = lead.assigned_user_id ? await connection.execute('SELECT id, name, email FROM users WHERE id = ?', [lead.assigned_user_id]) : [[]];
  const [positionRows] = await connection.execute(
    `SELECT pd.name AS pipeline_name, ps.name AS stage_name
     FROM prospect_pipeline_positions pp
     JOIN pipeline_definitions pd ON pd.id = pp.pipeline_id
     JOIN pipeline_stages ps ON ps.id = pp.stage_id
     WHERE pp.prospect_id = ? AND pd.owner_user_id = ?
     ORDER BY pp.updated_at DESC LIMIT 1`,
    [context.leadId, context.ownerUserId]
  );
  const position = positionRows[0] || {};
  const config = resolveConfig(rawConfig || {}, {
    lead: { name: lead.business_name, first_name: String(lead.business_name || '').split(/\s+/)[0], company: lead.business_name, phone: lead.phone, email: lead.email },
    owner: ownerRows[0] || {},
    assignee: assigneeRows[0] || {},
    pipeline: { name: position.pipeline_name, stage: position.stage_name },
    stage: { name: position.stage_name },
  });

  if (actionType === 'lead.add_tag' || actionType === 'lead.remove_tag') {
    const labelId = Number(config.labelId);
    if (!Number.isSafeInteger(labelId) || labelId <= 0) throw new Error('INVALID_LABEL');
    const [labels] = await connection.execute('SELECT id, name FROM lead_labels WHERE id = ? AND owner_user_id = ?', [labelId, context.ownerUserId]);
    if (!labels[0]) throw new Error('LABEL_NOT_FOUND');
    if (actionType === 'lead.add_tag') {
      await connection.execute('INSERT IGNORE INTO prospect_labels (prospect_id, label_id, created_by) VALUES (?, ?, ?)', [context.leadId, labelId, context.ownerUserId]);
      await emit(connection, 'lead.tag_added', context.leadId, { leadId: context.leadId, labelId }, context);
    } else {
      await connection.execute('DELETE FROM prospect_labels WHERE prospect_id = ? AND label_id = ?', [context.leadId, labelId]);
      await emit(connection, 'lead.tag_removed', context.leadId, { leadId: context.leadId, labelId }, context);
    }
    await writeHistory(connection, context.leadId, context.ownerUserId, `${definition.name}: ${labels[0].name}`, { actionType, automationId: context.automationId, runId: context.runId });
    return { labelId, labelName: labels[0].name };
  }

  if (actionType === 'lead.assign_user' || actionType === 'lead.unassign_user' || actionType === 'lead.remove_assignee') {
    const assignedUserId = actionType === 'lead.assign_user' ? Number(config.userId) : null;
    if (actionType === 'lead.assign_user' && (!Number.isSafeInteger(assignedUserId) || assignedUserId <= 0)) throw new Error('INVALID_USER');
    if (assignedUserId) {
      const [users] = await connection.execute("SELECT id FROM users WHERE id = ? AND is_active = 1 AND (can_access_crm = 1 OR LOWER(role) IN ('admin', 'administrator', 'administrador'))", [assignedUserId]);
      if (!users[0]) throw new Error('USER_NOT_FOUND');
    }
    await connection.execute('UPDATE prospects SET assigned_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [assignedUserId || null, context.leadId]);
    if (Number(lead.assigned_user_id || 0) !== Number(assignedUserId || 0)) await emit(connection, 'lead.assigned', context.leadId, { leadId: context.leadId, oldUserId: lead.assigned_user_id, newUserId: assignedUserId || null }, context);
    await writeHistory(connection, context.leadId, context.ownerUserId, definition.name, { actionType, automationId: context.automationId, runId: context.runId });
    return { assignedUserId: assignedUserId || null };
  }

  if (actionType === 'lead.update_status') {
    const status = String(config.status || '').trim();
    if (!status || status.length > 50) throw new Error('INVALID_STATUS');
    await connection.execute('UPDATE prospects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, context.leadId]);
    if (String(lead.status) !== status) await emit(connection, 'lead.status_changed', context.leadId, { leadId: context.leadId, oldStatus: lead.status, newStatus: status }, context);
    await writeHistory(connection, context.leadId, context.ownerUserId, `${definition.name}: ${status}`, { actionType, automationId: context.automationId, runId: context.runId });
    return { oldStatus: lead.status, newStatus: status };
  }

  if (actionType === 'lead.update_field') {
    const field = String(config.field || '');
    if (!FIELD_ALLOWLIST.has(field) || field === 'status') throw new Error('INVALID_LEAD_FIELD');
    await connection.execute(`UPDATE prospects SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [config.value == null ? null : String(config.value), context.leadId]);
    await emit(connection, 'lead.updated', context.leadId, { leadId: context.leadId, changedFields: [field] }, context);
    await writeHistory(connection, context.leadId, context.ownerUserId, `${definition.name}: ${field}`, { actionType, field, automationId: context.automationId, runId: context.runId });
    return { field };
  }

  if (actionType === 'lead.add_note') {
    const note = String(config.note || config.message || '').trim();
    if (!note) throw new Error('INVALID_NOTE');
    await writeHistory(connection, context.leadId, context.ownerUserId, note, { actionType, automationId: context.automationId, runId: context.runId });
    return { noteCreated: true };
  }

  if (actionType === 'lead.move_pipeline_stage') {
    const stageId = Number(config.stageId);
    if (!Number.isSafeInteger(stageId) || stageId <= 0) throw new Error('INVALID_STAGE');
    const [stages] = await connection.execute('SELECT ps.id, ps.pipeline_id, ps.name FROM pipeline_stages ps JOIN pipeline_definitions pd ON pd.id = ps.pipeline_id WHERE ps.id = ? AND pd.owner_user_id = ?', [stageId, context.ownerUserId]);
    if (!stages[0]) throw new Error('STAGE_NOT_FOUND');
    const [current] = await connection.execute('SELECT * FROM prospect_pipeline_positions WHERE prospect_id = ? AND pipeline_id = ? FOR UPDATE', [context.leadId, stages[0].pipeline_id]);
    const oldStageId = current[0]?.stage_id || null;
    await connection.execute(`INSERT INTO prospect_pipeline_positions (prospect_id, pipeline_id, stage_id, sort_order) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE entered_stage_at = IF(stage_id <> VALUES(stage_id), CURRENT_TIMESTAMP, entered_stage_at), stage_id = VALUES(stage_id), updated_at = CURRENT_TIMESTAMP`, [context.leadId, stages[0].pipeline_id, stageId]);
    if (Number(oldStageId || 0) !== stageId) await emit(connection, 'lead.pipeline_stage_changed', context.leadId, { leadId: context.leadId, pipelineId: stages[0].pipeline_id, oldStageId, newStageId: stageId }, context);
    await writeHistory(connection, context.leadId, context.ownerUserId, `${definition.name}: ${stages[0].name}`, { actionType, automationId: context.automationId, runId: context.runId });
    return { pipelineId: stages[0].pipeline_id, stageId, oldStageId };
  }

  if (actionType === 'activity.create' || actionType === 'activity.create_task' || actionType === 'activity.create_call' || actionType === 'activity.create_follow_up') {
    const title = String(config.title || config.name || '').trim();
    if (!title) throw new Error('INVALID_ACTIVITY_TITLE');
    const type = actionType === 'activity.create_task' ? 'task' : actionType === 'activity.create_call' ? 'call' : actionType === 'activity.create_follow_up' ? 'follow_up' : 'activity';
    const activityAssignee = Number(config.userId || lead.assigned_user_id || context.ownerUserId);
    const [activityUsers] = await connection.execute("SELECT id FROM users WHERE id = ? AND is_active = 1 AND (can_access_crm = 1 OR LOWER(role) IN ('admin', 'administrator', 'administrador'))", [activityAssignee]);
    if (!activityUsers[0]) throw new Error('USER_NOT_FOUND');
    const [activityResult] = await connection.execute('INSERT INTO lead_activities (prospect_id, type, title, description, assigned_user_id, due_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [context.leadId, type, title, config.description || null, activityAssignee, config.dueAt || null, context.ownerUserId]);
    await emit(connection, 'activity.created', context.leadId, { activityId: Number(activityResult.insertId), leadId: context.leadId }, context);
    await writeHistory(connection, context.leadId, context.ownerUserId, `${definition.name}: ${title}`, { actionType, automationId: context.automationId, runId: context.runId });
    return { title, type };
  }

  if (actionType === 'activity.complete') {
    const activityId = Number(config.activityId);
    if (!Number.isSafeInteger(activityId) || activityId <= 0) throw new Error('INVALID_ACTIVITY');
    const [result] = await connection.execute("UPDATE lead_activities SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND prospect_id = ?", [activityId, context.leadId]);
    if (!result.affectedRows) throw new Error('ACTIVITY_NOT_FOUND');
    await emit(connection, 'activity.completed', context.leadId, { activityId, leadId: context.leadId, completedAt: new Date().toISOString() }, context);
    return { activityId, completed: true };
  }

  if (actionType === 'notification.create') {
    const title = String(config.title || '').trim();
    const message = String(config.message || '').trim();
    if (!title || !message) throw new Error('INVALID_NOTIFICATION');
    const recipient = Number(config.userId || context.ownerUserId);
    const [recipients] = await connection.execute("SELECT id FROM users WHERE id = ? AND is_active = 1 AND (can_access_crm = 1 OR LOWER(role) IN ('admin', 'administrator', 'administrador'))", [recipient]);
    if (!recipients[0]) throw new Error('USER_NOT_FOUND');
    await connection.execute('INSERT INTO internal_notifications (user_id, type, title, message, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, \'lead\', ?, ?)', [recipient, config.type || 'info', title, message, context.leadId, JSON.stringify({ automationId: context.automationId, runId: context.runId })]);
    return { recipient, title };
  }

  throw new Error(`ACTION_NOT_IMPLEMENTED:${actionType}`);
}

module.exports = { executeAction, FIELD_ALLOWLIST };
