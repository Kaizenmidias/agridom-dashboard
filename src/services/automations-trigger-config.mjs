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
  if (type === TRIGGER_TYPES.LEAD_ADDED_TO_FOLDER) {
    const hasFolderIds = Array.isArray(config.folderIds);
    const folderIds = hasFolderIds ? config.folderIds : config.folderId === undefined ? undefined : [config.folderId];
    if (folderIds === undefined) return {};
    const normalizedFolderIds = folderIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0);
    return hasFolderIds
      ? { folderId: normalizedFolderIds[0], folderIds: normalizedFolderIds }
      : { folderId: normalizedFolderIds[0] };
  }
  if (type === TRIGGER_TYPES.WEBHOOK_RECEIVED) return config.webhookEndpointId === undefined ? {} : { webhookEndpointId: config.webhookEndpointId };
  return {};
}

export { TRIGGER_TYPES, triggerTypeFromDefinition, triggerConfigForType };
