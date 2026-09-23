const { ACTION_TYPES, STEP_TYPES, TRIGGER_TYPES } = require('./automation-catalog');

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
      } else if (step.type === 'wait' && step.config.duration !== undefined && (!Number.isInteger(step.config.duration) || step.config.duration <= 0)) {
        errors.push(error(`${path}.config.duration`, 'INVALID_WAIT_DURATION', 'Duracao de wait deve ser um inteiro positivo.'));
      } else if (step.type === 'wait' && step.config.amount !== undefined && (!Number.isInteger(step.config.amount) || step.config.amount <= 0)) {
        errors.push(error(`${path}.config.amount`, 'INVALID_WAIT_AMOUNT', 'Quantidade de wait deve ser um inteiro positivo.'));
      } else if (step.type === 'wait' && step.config.unit !== undefined && !['minutes', 'hours', 'days'].includes(step.config.unit)) {
        errors.push(error(`${path}.config.unit`, 'INVALID_WAIT_UNIT', 'Unidade de wait deve ser minutes, hours ou days.'));
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
    definition.steps.forEach((step, index) => {
      if (!isPlainObject(step)) return;
      for (const [field, target] of [['next', step.next], ['branches.yes', step.branches?.yes], ['branches.no', step.branches?.no]]) {
        if (typeof target === 'string' && !knownIds.has(target)) {
          errors.push(error(`steps[${index}].${field}`, 'UNKNOWN_STEP_REFERENCE', 'Referencia aponta para um step inexistente.'));
        }
      }
    });
  }

  return { valid: errors.length === 0, definition, errors };
}

module.exports = { validateAutomationDefinition };
