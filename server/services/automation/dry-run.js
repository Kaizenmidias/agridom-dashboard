const { getPool } = require('../../config/database');
const { validateAutomationDefinition } = require('../automation-definition-validator');
const { evaluateCondition } = require('./condition-evaluator');

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
    const planned = [];
    const visited = new Set();
    let stepId = steps[0]?.id;
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
        planned.push({ id: step.id, type: step.type, actionType: step.config.actionType, wouldExecute: true });
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
