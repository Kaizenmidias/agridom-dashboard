const crypto = require('node:crypto');

const GMAIL_CONNECTION_STATUSES = Object.freeze([
  'disconnected',
  'connecting',
  'connected',
  'reconnect_required',
  'error',
]);

function assertGmailConnectionStatus(status) {
  if (!GMAIL_CONNECTION_STATUSES.includes(String(status))) {
    const error = new Error('Status de conexao Gmail invalido.');
    error.code = 'INVALID_GMAIL_CONNECTION_STATUS';
    throw error;
  }
  return String(status);
}

function publicGmailConnection(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    provider: row.provider,
    emailAddress: row.email_address || null,
    displayName: row.display_name || null,
    status: assertGmailConnectionStatus(row.status),
    scopesGranted: row.scopes_granted || null,
    connectedAt: row.connected_at || null,
    lastRefreshedAt: row.last_refreshed_at || null,
    lastErrorCode: row.last_error_code || null,
    disconnectedAt: row.disconnected_at || null,
    hasRefreshToken: Boolean(row.refresh_token_ciphertext && row.refresh_token_iv && row.refresh_token_auth_tag),
  };
}

function createStateMaterial() {
  const state = crypto.randomBytes(32).toString('base64url');
  return {
    state,
    stateHash: crypto.createHash('sha256').update(state, 'utf8').digest('hex'),
  };
}

function assertAdministrativeGmailAccess(context) {
  const userId = Number(context?.userId);
  const user = context?.commercialUser;
  const role = String(user?.role || '').toLowerCase();
  const authenticated = Number.isSafeInteger(userId) && userId > 0;
  const active = user?.is_active === 1 || user?.is_active === true;
  const commercialAccess = user?.can_access_crm === 1 || user?.can_access_crm === true;
  const administrator = ['admin', 'administrator', 'administrador'].includes(role);
  if (!authenticated || !active || !commercialAccess || !administrator) {
    const error = new Error('Apenas administradores ativos podem gerenciar a integracao Gmail.');
    error.code = 'GMAIL_ADMIN_ACCESS_REQUIRED';
    throw error;
  }
  return true;
}

module.exports = {
  GMAIL_CONNECTION_STATUSES,
  assertGmailConnectionStatus,
  publicGmailConnection,
  createStateMaterial,
  assertAdministrativeGmailAccess,
};
