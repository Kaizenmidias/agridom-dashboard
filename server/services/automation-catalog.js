const TRIGGER_TYPES = Object.freeze([
  'lead.created',
  'lead.status_changed',
  'lead.pipeline_stage_changed',
  'lead.tag_added',
  'lead.tag_removed',
  'lead.assigned',
  'lead.converted',
  'activity.created',
  'activity.completed',
]);

const STEP_TYPES = Object.freeze(['condition', 'wait', 'action']);

const ACTION_TYPES = Object.freeze([
  'lead.update_status',
  'lead.move_pipeline_stage',
  'lead.add_tag',
  'lead.remove_tag',
  'lead.assign_user',
  'activity.create',
  'notification.create',
  'email.send',
  'whatsapp.send',
]);

const isSupported = (catalog, value) => catalog.includes(value);

module.exports = {
  TRIGGER_TYPES,
  STEP_TYPES,
  ACTION_TYPES,
  isSupported,
};
