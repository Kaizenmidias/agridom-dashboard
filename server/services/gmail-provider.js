const { decryptRefreshToken, refreshAccessToken } = require('./gmail-oauth');
const { getCurrentConnection } = require('./gmail-oauth-repository');

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

function encodeMessage({ to, subject, text, from }) {
  const lines = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
}

async function sendGmail(pool, message, { fetchImpl = fetch } = {}) {
  const connection = await getCurrentConnection(pool);
  if (!connection || connection.status !== 'connected' || !connection.refresh_token_ciphertext) {
    const error = new Error('GMAIL_NOT_CONNECTED');
    error.code = 'GMAIL_NOT_CONNECTED';
    error.retryable = false;
    throw error;
  }
  const scopes = typeof connection.scopes_granted === 'string' ? JSON.parse(connection.scopes_granted) : connection.scopes_granted;
  if (!Array.isArray(scopes) || !scopes.includes(GMAIL_SEND_SCOPE)) {
    const error = new Error('GMAIL_SCOPE_REQUIRED');
    error.code = 'GMAIL_SCOPE_REQUIRED';
    error.retryable = false;
    throw error;
  }
  const refreshToken = decryptRefreshToken(connection);
  const tokens = await refreshAccessToken(refreshToken, { fetchImpl });
  if (!tokens?.access_token) {
    const error = new Error('GMAIL_ACCESS_TOKEN_MISSING');
    error.code = 'GMAIL_ACCESS_TOKEN_MISSING';
    throw error;
  }
  const raw = encodeMessage({ ...message, from: connection.email_address });
  const response = await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) {
    const error = new Error('Falha no envio Gmail.');
    error.code = response.status === 401 ? 'GMAIL_AUTH_FAILED' : 'GMAIL_SEND_FAILED';
    error.retryable = response.status >= 500 || response.status === 429;
    throw error;
  }
  return { messageId: payload.id, provider: 'gmail' };
}

module.exports = { encodeMessage, sendGmail };
