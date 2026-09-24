const { getPool } = require('../../config/database');
const { validateAutomationDefinition } = require('../automation-definition-validator');
const { evaluateCondition } = require('./condition-evaluator');
const { resolveConfig } = require('./variable-resolver');
const { decryptSecret } = require('../integration-crypto');
const { validateSmtpConfig } = require('../email-provider');
const { normalizePhone } = require('../whatsapp-service');

async function dryRunAutomation({ definition, leadId, ownerUserId }) {
  const validation = validateAutomationDefinition(definition, { requireSteps: true });
  if (!validation.valid) {
    const error = new Error('AUTOMATION_DEFINITION_INVALID');
    error.details = validation.errors;
    throw error;
  }
  const steps = validation.definition.steps;
  const byId = new Map(steps.map((step) => [step.id, step]));
  const connection = await getPool().getConnection();
  try {
    const [leadRows] = await connection.execute('SELECT id, business_name, email, phone FROM prospects WHERE id = ? AND owner_user_id = ?', [leadId, ownerUserId]);
    if (!leadRows[0]) throw new Error('LEAD_NOT_FOUND');
    const [ownerRows] = await connection.execute('SELECT name, email FROM users WHERE id = ?', [ownerUserId]);
    const lead = leadRows[0];
    const templateContext = { lead: { name: lead.business_name, first_name: String(lead.business_name || '').split(/\s+/)[0], company: lead.business_name, email: lead.email, phone: lead.phone }, owner: ownerRows[0] || {} };
    const planned = [];
    const visited = new Set();
    let stepId = validation.definition.trigger?.next || steps[0]?.id;
    while (stepId) {
      if (visited.has(stepId)) throw new Error('AUTOMATION_LOOP_DETECTED');
      visited.add(stepId);
      const step = byId.get(stepId);
      if (!step) throw new Error(`UNKNOWN_STEP_REFERENCE:${stepId}`);
      if (step.type === 'condition') {
        const result = await evaluateCondition(connection, step.config, { leadId, ownerUserId });
        const branch = result.result ? 'yes' : 'no';
        planned.push({ id: step.id, type: step.type, result: result.result, branch, field: result.field, operator: result.operator });
        stepId = step.branches?.[branch] || null;
      } else if (step.type === 'wait') {
        planned.push({ id: step.id, type: step.type, wait: { amount: step.config?.amount ?? step.config?.duration, unit: step.config?.unit || 'minutes' } });
        stepId = step.next || null;
      } else if (step.type === 'action') {
        if (step.config.actionType === 'email.send') {
          const resolved = resolveConfig(step.config, templateContext);
          if (!lead.email) throw new Error('RECIPIENT_EMAIL_MISSING');
          if (!resolved.subject || !resolved.message) throw new Error('INVALID_EMAIL_TEMPLATE');
          const [integrationRows] = await connection.execute("SELECT * FROM integration_providers WHERE provider = 'smtp' LIMIT 1");
          if (!integrationRows[0]) throw new Error('EMAIL_INTEGRATION_NOT_CONFIGURED');
          const secret = decryptSecret(integrationRows[0]);
          validateSmtpConfig({ ...JSON.parse(integrationRows[0].configuration_metadata || '{}'), password: secret?.password });
          planned.push({ id: step.id, type: step.type, actionType: step.config.actionType, recipient: lead.email, subject: resolved.subject, message: resolved.message, wouldExecute: true, sent: false });
        } else if (step.config.actionType === 'whatsapp.send') {
          const resolved = resolveConfig(step.config, templateContext);
          const recipient = normalizePhone(resolved.recipient || lead.phone);
          if (!recipient) throw new Error('RECIPIENT_PHONE_MISSING');
          if (!String(resolved.message || '').trim()) throw new Error('INVALID_WHATSAPP_MESSAGE');
          const accountId = Number(resolved.accountId || 0);
          const [accounts] = await connection.execute("SELECT id, name, status FROM communication_accounts WHERE channel = 'whatsapp' AND archived_at IS NULL AND status = 'connected' AND (? = 0 OR id = ?) AND (owner_user_id = ? OR owner_user_id IS NULL) ORDER BY id LIMIT 1", [accountId, accountId, ownerUserId]);
          if (!accounts[0]) throw new Error(accountId ? 'WHATSAPP_ACCOUNT_NOT_CONNECTED' : 'WHATSAPP_NOT_CONFIGURED');
          planned.push({ id: step.id, type: step.type, actionType: step.config.actionType, accountId: Number(accounts[0].id), accountName: accounts[0].name, recipient, message: String(resolved.message).trim(), wouldExecute: true, sent: false });
        } else planned.push({ id: step.id, type: step.type, actionType: step.config.actionType, wouldExecute: true });
        stepId = step.next || null;
      } else if (step.type === 'finish') {
        planned.push({ id: step.id, type: step.type, completed: true });
        stepId = null;
      } else {
        throw new Error(`UNKNOWN_STEP_TYPE:${step.type}`);
      }
    }
    return { dryRun: true, leadId: Number(leadId), steps: planned, writes: 0, externalMessages: 0 };
  } finally {
    connection.release();
  }
}

module.exports = { dryRunAutomation };
