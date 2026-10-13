const crypto = require('node:crypto');
const { decryptSecret } = require('./integration-crypto');

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const GMAIL_SCOPES = Object.freeze(['openid', 'email', 'https://www.googleapis.com/auth/gmail.send']);

function oauthConfig(env = process.env) {
  const config = { clientId: String(env.GOOGLE_GMAIL_CLIENT_ID || ''), clientSecret: String(env.GOOGLE_GMAIL_CLIENT_SECRET || ''), redirectUri: String(env.GOOGLE_GMAIL_REDIRECT_URI || '') };
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    const error = new Error('OAuth Gmail nao configurado no servidor.');
    error.code = 'GMAIL_OAUTH_NOT_CONFIGURED';
    throw error;
  }
  let redirect;
  try { redirect = new URL(config.redirectUri); } catch { throw Object.assign(new Error('Redirect URI Gmail invalida.'), { code: 'GMAIL_OAUTH_REDIRECT_INVALID' }); }
  const production = String(env.NODE_ENV || '').toLowerCase() === 'production';
  if (production && redirect.protocol !== 'https:') throw Object.assign(new Error('Redirect URI Gmail deve usar HTTPS em producao.'), { code: 'GMAIL_OAUTH_REDIRECT_INVALID' });
  if (!production && redirect.protocol !== 'https:' && !(redirect.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(redirect.hostname))) throw Object.assign(new Error('Redirect URI local Gmail deve usar localhost ou 127.0.0.1.'), { code: 'GMAIL_OAUTH_REDIRECT_INVALID' });
  return config;
}

function createPkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function buildAuthorizationUrl({ state, challenge, env = process.env }) {
  const config = oauthConfig(env);
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: GMAIL_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256' });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

async function parseResponse(response, code) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Falha na comunicacao OAuth Gmail.');
    error.code = code;
    error.providerCode = String(payload.error || response.status);
    throw error;
  }
  return payload;
}

async function exchangeCode({ code, codeVerifier, fetchImpl = fetch, env = process.env }) {
  const config = oauthConfig(env);
  const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: codeVerifier }).toString() });
  return parseResponse(response, 'GMAIL_TOKEN_EXCHANGE_FAILED');
}

async function identifyAccount(accessToken, { fetchImpl = fetch, allowedEmail = process.env.GOOGLE_GMAIL_ALLOWED_EMAIL } = {}) {
  const response = await fetchImpl(GOOGLE_USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` } });
  const identity = await parseResponse(response, 'GMAIL_IDENTITY_FAILED');
  if (!identity.sub || !identity.email || identity.email_verified !== true || (allowedEmail && String(identity.email).toLowerCase() !== String(allowedEmail).toLowerCase())) {
    const error = new Error('A conta Google autorizada nao atende aos criterios da integracao.');
    error.code = 'GMAIL_IDENTITY_NOT_ALLOWED';
    throw error;
  }
  return identity;
}

async function refreshAccessToken(refreshToken, { fetchImpl = fetch, env = process.env } = {}) {
  const config = oauthConfig(env);
  const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString() });
  return parseResponse(response, 'GMAIL_TOKEN_REFRESH_FAILED');
}

async function revokeToken(token, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(GOOGLE_REVOKE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }).toString() });
  if (!response.ok) { const error = new Error('Falha ao revogar a conexao Gmail.'); error.code = 'GMAIL_REVOCATION_FAILED'; throw error; }
}

function decryptRefreshToken(row) {
  const value = decryptSecret({ secret_ciphertext: row?.refresh_token_ciphertext, secret_iv: row?.refresh_token_iv, secret_auth_tag: row?.refresh_token_auth_tag });
  if (!value?.refreshToken) { const error = new Error('Refresh token Gmail ausente.'); error.code = 'GMAIL_REFRESH_TOKEN_MISSING'; throw error; }
  return value.refreshToken;
}

module.exports = { GMAIL_SCOPES, oauthConfig, createPkce, buildAuthorizationUrl, exchangeCode, identifyAccount, refreshAccessToken, revokeToken, decryptRefreshToken };
