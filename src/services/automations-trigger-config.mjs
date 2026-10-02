const TRIGGER_TYPES = {
  LEAD_CREATED: "lead.created",
  LEAD_ADDED_TO_FOLDER: "lead.added_to_folder",
  WEBHOOK_RECEIVED: "webhook.received",
  UNCONFIGURED: "__unconfigured__",
};

function triggerTypeFromDefinition(definition, fallback) {
  const type = definition?.trigger?.type;
  return type && type !== TRIGGER_TYPES.UNCONFIGURED ? type : fallback || TRIGGER_TYPES.UNCONFIGURED;
}

function triggerConfigForType(type, config = {}) {
  if (type === TRIGGER_TYPES.LEAD_ADDED_TO_FOLDER) return config.folderId === undefined ? {} : { folderId: config.folderId };
  if (type === TRIGGER_TYPES.WEBHOOK_RECEIVED) return config.webhookEndpointId === undefined ? {} : { webhookEndpointId: config.webhookEndpointId };
  return {};
}

export { TRIGGER_TYPES, triggerTypeFromDefinition, triggerConfigForType };
