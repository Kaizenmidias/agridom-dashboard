function normalizeIntegrationMetadata(value) {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Metadata da integracao possui formato invalido.'), { code: 'INTEGRATION_METADATA_INVALID' });
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw Object.assign(new Error('Metadata da integracao possui JSON invalido.'), { code: 'INTEGRATION_METADATA_INVALID' });
  }
}

module.exports = { normalizeIntegrationMetadata };
