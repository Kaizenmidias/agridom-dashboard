const { ACTION_CATALOG } = require('../automation-catalog');

function getActionDefinition(actionType) {
  return ACTION_CATALOG.find((item) => item.id === actionType) || null;
}

function isExecutable(actionType) {
  return getActionDefinition(actionType)?.availability === 'available';
}

module.exports = { getActionDefinition, isExecutable };
