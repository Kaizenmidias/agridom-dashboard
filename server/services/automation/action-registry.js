const { ACTION_CATALOG } = require('../automation-catalog');

const LEAD_REQUIRED_ACTIONS = Object.freeze(new Set([
  'lead.update_status', 'lead.assign_user', 'lead.remove_assignee', 'lead.update_field',
  'lead.add_note', 'lead.add_tag', 'lead.remove_tag', 'lead.move_pipeline_stage',
  'activity.create', 'activity.create_task', 'activity.create_call', 'activity.create_follow_up',
  'activity.complete', 'notification.create', 'email.send', 'whatsapp.send',
  'whatsapp.send_message', 'whatsapp.send_template', 'whatsapp.send_file', 'whatsapp.send_image',
]));

function getActionDefinition(actionType) {
  return ACTION_CATALOG.find((item) => item.id === actionType) || null;
}

function isExecutable(actionType) {
  return getActionDefinition(actionType)?.availability === 'available';
}

module.exports = { getActionDefinition, isExecutable, LEAD_REQUIRED_ACTIONS };
