const { dispatchDomainEvent } = require('../domain-events');
const { getPool } = require('../../config/database');
const { getActionDefinition, isExecutable } = require('./action-registry');
const { resolveConfig } = require('./variable-resolver');
const { decryptSecret } = require('../integration-crypto');
const { validateSmtpConfig, sendSmtp } = require('../email-provider');
const { sendWhatsAppMessage, normalizePhone } = require('../whatsapp-service');

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

  if (actionType === 'email.send') {
    const recipient = String(config.recipient || lead.email || '').trim();
    if (!recipient) { const error = new Error('RECIPIENT_EMAIL_MISSING'); error.code = 'RECIPIENT_EMAIL_MISSING'; error.retryable = false; throw error; }
    const [integrationRows] = await connection.execute("SELECT * FROM integration_providers WHERE provider = 'smtp' LIMIT 1");
    if (!integrationRows[0]) { const error = new Error('EMAIL_INTEGRATION_NOT_CONFIGURED'); error.code = 'EMAIL_INTEGRATION_NOT_CONFIGURED'; error.retryable = false; throw error; }
    const secret = decryptSecret(integrationRows[0]);
    const metadata = JSON.parse(integrationRows[0].configuration_metadata || '{}');
    const smtp = validateSmtpConfig({ ...metadata, password: secret?.password });
    const subject = String(config.subject || '').trim();
    const message = String(config.message || '').trim();
    if (!subject) { const error = new Error('INVALID_EMAIL_SUBJECT'); error.code = 'INVALID_EMAIL_SUBJECT'; error.retryable = false; throw error; }
    if (!message) { const error = new Error('INVALID_EMAIL_MESSAGE'); error.code = 'INVALID_EMAIL_MESSAGE'; error.retryable = false; throw error; }
    const idempotencyKey = `email:${context.idempotencyKey}`;
    const [existingRows] = await connection.execute('SELECT * FROM communication_messages WHERE idempotency_key = ? FOR UPDATE', [idempotencyKey]);
    if (existingRows[0]?.status === 'sent') return { recipient, subject, messageId: existingRows[0].provider_message_id, idempotent: true };
    if (existingRows[0]) await connection.execute("UPDATE communication_messages SET status = 'sending', attempt_count = attempt_count + 1, error_code = NULL, error_message = NULL WHERE id = ?", [existingRows[0].id]);
    else await connection.execute("INSERT INTO communication_messages (channel, direction, lead_id, automation_id, automation_run_id, automation_step_id, idempotency_key, recipient, subject, body_text, status, provider, attempt_count) VALUES ('email', 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, 'sending', 'smtp', 1)", [context.leadId, context.automationId, context.runId, context.stepId, idempotencyKey, recipient, subject, message]);
    let result;
    try {
      result = await sendSmtp(smtp, { to: recipient, subject, text: message, replyTo: config.replyTo || undefined });
    } catch (error) {
      const auditConnection = await getPool().getConnection();
      try {
        await auditConnection.execute(
          "INSERT INTO communication_messages (channel, direction, lead_id, automation_id, automation_run_id, automation_step_id, idempotency_key, recipient, subject, body_text, status, provider, attempt_count, error_code, error_message, failed_at) VALUES ('email', 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, 'failed', 'smtp', 1, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status = 'failed', attempt_count = attempt_count + 1, error_code = VALUES(error_code), error_message = VALUES(error_message), failed_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP",
          [context.leadId, context.automationId, context.runId, context.stepId, idempotencyKey, recipient, subject, message, error.code || 'SMTP_SEND_FAILED', String(error.publicMessage || error.code || 'Falha no envio SMTP').slice(0, 500)]
        );
      } finally {
        auditConnection.release();
      }
      throw error;
    }
    await connection.execute("UPDATE communication_messages SET status = 'sent', provider_message_id = ?, sent_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP WHERE idempotency_key = ?", [result.messageId, idempotencyKey]);
    await writeHistory(connection, context.leadId, context.ownerUserId, `E-mail enviado: ${subject}`, { actionType, automationId: context.automationId, runId: context.runId, communicationMessageId: idempotencyKey });
    return { recipient, subject, messageId: result.messageId };
  }

  if (actionType === 'whatsapp.send') {
    const recipient = normalizePhone(config.recipient || lead.phone);
    if (!recipient) { const error = new Error('RECIPIENT_PHONE_MISSING'); error.code = 'RECIPIENT_PHONE_MISSING'; error.retryable = false; error.publicMessage = 'Telefone do Lead nao informado.'; throw error; }
    const message = String(config.message || '').trim();
    if (!message) { const error = new Error('INVALID_WHATSAPP_MESSAGE'); error.code = 'INVALID_WHATSAPP_MESSAGE'; error.retryable = false; error.publicMessage = 'Mensagem WhatsApp obrigatoria.'; throw error; }
    const accountId = Number(config.accountId || 0);
    const [accounts] = await connection.execute("SELECT * FROM communication_accounts WHERE channel = 'whatsapp' AND archived_at IS NULL AND status = 'connected' AND (? = 0 OR id = ?) AND (owner_user_id = ? OR owner_user_id IS NULL) ORDER BY id LIMIT 1", [accountId, accountId, context.ownerUserId]);
    if (!accounts[0]) { const error = new Error(accountId ? 'WHATSAPP_ACCOUNT_NOT_CONNECTED' : 'WHATSAPP_NOT_CONFIGURED'); error.code = error.message; error.retryable = false; error.publicMessage = 'Conecte um numero WhatsApp em Administracao > Integracoes.'; throw error; }
    const result = await sendWhatsAppMessage(connection, { account: accounts[0], leadId: context.leadId, recipient, text: message, idempotencyKey: `whatsapp:${context.idempotencyKey}`, automationId: context.automationId, runId: context.runId, stepId: context.stepId, ownerUserId: context.ownerUserId });
    await writeHistory(connection, context.leadId, context.ownerUserId, `WhatsApp enviado: ${message.slice(0, 120)}`, { actionType, automationId: context.automationId, runId: context.runId, communicationMessageId: result.externalMessageId || result.messageId });
    return { recipient, messageId: result.externalMessageId || result.messageId, conversationId: result.conversationId, idempotent: Boolean(result.idempotent) };
  }

  throw new Error(`ACTION_NOT_IMPLEMENTED:${actionType}`);
}

module.exports = { executeAction, FIELD_ALLOWLIST };
