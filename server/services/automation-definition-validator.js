const { ACTION_CATALOG, ACTION_TYPES, STEP_TYPES, TRIGGER_TYPES } = require('./automation-catalog');

const SECRET_KEYS = new Set([
  'token',
  'secret',
  'password',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'authorization',
  'credential',
  'credentials',
]);
const ALLOWED_VARIABLES = new Set(['lead.name', 'lead.first_name', 'lead.company', 'lead.phone', 'lead.email', 'assignee.name', 'assignee.email', 'pipeline.name', 'pipeline.stage']);

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function error(path, code, message) {
  return { path, code, message };
}

function findSecretKey(value, path = '') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSecretKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  if (!isPlainObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (SECRET_KEYS.has(key.toLowerCase())) {
      return error(childPath, 'SECRET_NOT_ALLOWED', 'Definitions nao podem armazenar tokens, senhas ou credenciais.');
    }
    const found = findSecretKey(child, childPath);
    if (found) return found;
  }
  return null;
}

function findInvalidVariable(value, path = '') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findInvalidVariable(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'string') {
    const matches = value.matchAll(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g);
    for (const match of matches) if (!ALLOWED_VARIABLES.has(match[1])) return error(path, 'UNKNOWN_VARIABLE', `Variavel nao permitida: ${match[1]}.`);
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    const found = findInvalidVariable(child, path ? `${path}.${key}` : key);
    if (found) return found;
  }
  return null;
}

function validateAutomationDefinition(input, options = {}) {
  const errors = [];
  let definition = input;

  if (typeof definition === 'string') {
    try {
      definition = JSON.parse(definition);
    } catch {
      return { valid: false, definition: null, errors: [error('$', 'INVALID_JSON', 'Definition deve ser um JSON valido.')] };
    }
  }

  if (!isPlainObject(definition)) {
    return { valid: false, definition: null, errors: [error('$', 'INVALID_STRUCTURE', 'Definition deve ser um objeto JSON.')] };
  }

  const secretError = findSecretKey(definition);
  if (secretError) errors.push(secretError);
  const invalidVariable = findInvalidVariable(definition);
  if (invalidVariable) errors.push(invalidVariable);

  if (definition.schemaVersion !== 1) {
    errors.push(error('schemaVersion', 'UNSUPPORTED_SCHEMA_VERSION', 'Apenas schemaVersion 1 e suportado.'));
  }

  if (!isPlainObject(definition.trigger)) {
    errors.push(error('trigger', 'INVALID_TRIGGER', 'Trigger deve ser um objeto.'));
  } else {
    if (!TRIGGER_TYPES.includes(definition.trigger.type)) {
      errors.push(error('trigger.type', 'UNKNOWN_TRIGGER', 'Tipo de trigger nao reconhecido.'));
    }
    if (definition.trigger.config !== undefined && !isPlainObject(definition.trigger.config)) {
      errors.push(error('trigger.config', 'INVALID_TRIGGER_CONFIG', 'Configuracao do trigger deve ser um objeto.'));
    }
    if (definition.trigger.next !== undefined && definition.trigger.next !== null && typeof definition.trigger.next !== 'string') {
      errors.push(error('trigger.next', 'INVALID_TRIGGER_REFERENCE', 'Referencia do trigger deve ser texto ou null.'));
    }
  }

  if (!Array.isArray(definition.steps)) {
    errors.push(error('steps', 'INVALID_STEPS', 'Steps deve ser uma lista.'));
  } else {
    if (options.requireSteps && definition.steps.length === 0) {
      errors.push(error('steps', 'EMPTY_STEPS', 'Uma versao publicada precisa ter pelo menos um step.'));
    }

    const ids = new Set();
    for (let index = 0; index < definition.steps.length; index += 1) {
      const step = definition.steps[index];
      const path = `steps[${index}]`;
      if (!isPlainObject(step)) {
        errors.push(error(path, 'INVALID_STEP', 'Step deve ser um objeto.'));
        continue;
      }

      if (typeof step.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,99}$/.test(step.id)) {
        errors.push(error(`${path}.id`, 'INVALID_STEP_ID', 'ID do step deve iniciar com letra e conter apenas letras, numeros, _ ou -.'));
      } else if (ids.has(step.id)) {
        errors.push(error(`${path}.id`, 'DUPLICATE_STEP_ID', 'IDs de steps devem ser unicos dentro da versao.'));
      } else {
        ids.add(step.id);
      }

      if (!STEP_TYPES.includes(step.type)) {
        errors.push(error(`${path}.type`, 'UNKNOWN_STEP_TYPE', 'Tipo de step nao reconhecido.'));
      }
      if (!isPlainObject(step.config)) {
        errors.push(error(`${path}.config`, 'INVALID_STEP_CONFIG', 'Configuracao do step deve ser um objeto.'));
      } else if (step.type === 'action' && !ACTION_TYPES.includes(step.config.actionType)) {
        errors.push(error(`${path}.config.actionType`, 'UNKNOWN_ACTION_TYPE', 'Tipo de action nao reconhecido.'));
      } else if (step.type === 'action' && options.requireExecutableActions) {
        const catalogItem = ACTION_CATALOG.find((item) => item.id === step.config.actionType);
        if (!catalogItem || catalogItem.availability !== 'available') {
          errors.push(error(`${path}.config.actionType`, 'ACTION_NOT_EXECUTABLE', catalogItem?.availability === 'requires_integration' ? `Action requer integracao: ${catalogItem.requiredIntegration}.` : 'Action ainda nao possui executor seguro.'));
        }
        const requiredFields = {
          'lead.add_tag': ['labelId'], 'lead.remove_tag': ['labelId'], 'lead.assign_user': ['userId'],
          'lead.update_status': ['status'], 'lead.update_field': ['field', 'value'], 'lead.add_note': ['note'],
          'lead.move_pipeline_stage': ['stageId'], 'activity.create': ['title'], 'activity.create_task': ['title'],
          'activity.create_call': ['title'], 'activity.create_follow_up': ['title'], 'activity.complete': ['activityId'],
          'notification.create': ['title', 'message'],
          'email.send': ['subject', 'message'],
        }[step.config.actionType] || [];
        requiredFields.forEach((field) => {
          if (step.config[field] === undefined || step.config[field] === null || step.config[field] === '') errors.push(error(`${path}.config.${field}`, 'MISSING_ACTION_CONFIG', `Configuracao obrigatoria ausente: ${field}.`));
        });
        if (step.config.actionType === 'lead.update_field' && !['business_name', 'category', 'address', 'city', 'state', 'phone', 'email', 'website'].includes(step.config.field)) errors.push(error(`${path}.config.field`, 'INVALID_LEAD_FIELD', 'Campo de Lead nao permitido.'));
      } else if (step.type === 'wait' && step.config.duration !== undefined && (!Number.isInteger(step.config.duration) || step.config.duration <= 0)) {
        errors.push(error(`${path}.config.duration`, 'INVALID_WAIT_DURATION', 'Duracao de wait deve ser um inteiro positivo.'));
      } else if (step.type === 'wait' && step.config.amount !== undefined && (!Number.isInteger(step.config.amount) || step.config.amount <= 0)) {
        errors.push(error(`${path}.config.amount`, 'INVALID_WAIT_AMOUNT', 'Quantidade de wait deve ser um inteiro positivo.'));
      } else if (step.type === 'wait' && step.config.unit !== undefined && !['minutes', 'hours', 'days'].includes(step.config.unit)) {
        errors.push(error(`${path}.config.unit`, 'INVALID_WAIT_UNIT', 'Unidade de wait deve ser minutes, hours ou days.'));
      }
      if (options.requireSteps && step.type === 'condition' && (!['status', 'pipeline', 'pipeline_stage', 'assigned_user', 'origin', 'source', 'phone', 'email', 'website', 'label'].includes(step.config?.field) || !['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty', 'has_label', 'does_not_have_label'].includes(step.config?.operator))) {
        errors.push(error(`${path}.config`, 'INVALID_CONDITION', 'Campo ou operador de condicao nao permitido.'));
      }

      for (const field of ['next']) {
        if (step[field] !== undefined && step[field] !== null && typeof step[field] !== 'string') {
          errors.push(error(`${path}.${field}`, 'INVALID_STEP_REFERENCE', 'Referencia de step deve ser texto ou null.'));
        }
      }
      if (step.branches !== undefined) {
        if (!isPlainObject(step.branches)) {
          errors.push(error(`${path}.branches`, 'INVALID_BRANCHES', 'Branches deve ser um objeto.'));
        } else {
          for (const branch of ['yes', 'no']) {
            if (step.branches[branch] !== undefined && step.branches[branch] !== null && typeof step.branches[branch] !== 'string') {
              errors.push(error(`${path}.branches.${branch}`, 'INVALID_BRANCH_REFERENCE', 'Referencia de branch deve ser texto ou null.'));
            }
          }
        }
      }
    }

    const knownIds = new Set(definition.steps.filter((step) => isPlainObject(step) && typeof step.id === 'string').map((step) => step.id));
    if (definition.trigger.next === undefined && !Object.prototype.hasOwnProperty.call(definition, 'layout') && definition.steps.length) {
      definition = { ...definition, trigger: { ...definition.trigger, next: definition.steps[0]?.id || null } };
    }
    if (typeof definition.trigger.next === 'string' && !knownIds.has(definition.trigger.next)) {
      errors.push(error('trigger.next', 'UNKNOWN_STEP_REFERENCE', 'Referencia do trigger aponta para um step inexistente.'));
    }
    definition.steps.forEach((step, index) => {
      if (!isPlainObject(step)) return;
      for (const [field, target] of [['next', step.next], ['branches.yes', step.branches?.yes], ['branches.no', step.branches?.no]]) {
        if (typeof target === 'string' && !knownIds.has(target)) {
          errors.push(error(`steps[${index}].${field}`, 'UNKNOWN_STEP_REFERENCE', 'Referencia aponta para um step inexistente.'));
        }
      }
    });
    if (options.requireSteps && definition.steps.length) {
      const byId = new Map(definition.steps.filter((step) => isPlainObject(step) && typeof step.id === 'string').map((step) => [step.id, step]));
      const reachable = new Set();
      if (!definition.trigger.next) errors.push(error('trigger.next', 'TRIGGER_NOT_CONNECTED', 'O gatilho precisa estar conectado ao fluxo.'));
      const queue = definition.trigger.next ? [definition.trigger.next] : [];
      while (queue.length) {
        const currentId = queue.shift();
        if (!currentId || reachable.has(currentId)) continue;
        reachable.add(currentId);
        const current = byId.get(currentId);
        if (!current) continue;
        [current.next, current.branches?.yes, current.branches?.no].forEach((target) => { if (target && !reachable.has(target)) queue.push(target); });
      }
      definition.steps.forEach((step, index) => { if (typeof step?.id === 'string' && !reachable.has(step.id)) errors.push(error(`steps[${index}]`, 'ORPHAN_STEP', 'Step nao alcancavel a partir do primeiro node.')); });
    }
  }

  return { valid: errors.length === 0, definition, errors };
}

module.exports = { validateAutomationDefinition };
