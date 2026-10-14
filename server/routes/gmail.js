const express = require('express');
const crypto = require('node:crypto');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess, requireCommercialAdmin } = require('../middleware/commercial-access');
const { getPool } = require('../config/database');
const { assertAdministrativeGmailAccess, createStateMaterial, publicGmailConnection } = require('../services/gmail-connection-foundation');
const oauth = require('../services/gmail-oauth');
const repository = require('../services/gmail-oauth-repository');

function createGmailRouter(deps = {}) {
  const router = express.Router();
  const pool = deps.pool || getPool();
  const oauthService = deps.oauth || oauth;
  const repo = deps.repository || repository;
  const admin = [authenticateToken, requireCommercialAccess, requireCommercialAdmin];
  const redirectTarget = () => process.env.GMAIL_OAUTH_RESULT_URL || '/administracao/integracoes';
  const safeRedirect = (status) => `${redirectTarget()}${redirectTarget().includes('?') ? '&' : '?'}gmail=${encodeURIComponent(status)}`;
  const oauthResult = (status) => `<!doctype html><html><head><meta charset="utf-8"><title>Gmail</title></head><body><p id="message">Concluindo a conexão Gmail...</p><button id="close" hidden>Fechar janela</button><script>const status=${JSON.stringify(status)};const message={type:'kaizen:gmail-oauth',status};const target=window.location.origin;try{if(window.opener&&!window.opener.closed)window.opener.postMessage(message,target)}catch{};document.getElementById('message').textContent=status==='connected'?'Gmail conectado com sucesso.':status==='cancelled'?'A autorização Gmail foi cancelada.':'Não foi possível concluir a autorização Gmail.';const close=document.getElementById('close');try{window.close()}catch{};if(!window.closed){close.hidden=false;close.onclick=()=>window.close()}</script></body></html>`;

  const startOAuth = async (req, res) => {
    try {
      assertAdministrativeGmailAccess({ userId: req.userId, commercialUser: req.commercialUser });
      const stateMaterial = createStateMaterial();
      const pkce = oauthService.createPkce();
      const current = await repo.getCurrentConnection(pool);
      await repo.createOAuthState(pool, { userId: req.userId, stateHash: stateMaterial.stateHash, codeVerifier: pkce.verifier, expiresAt: new Date(Date.now() + 10 * 60 * 1000), intent: current ? 'reconnect' : 'initial', baseConnectionId: current?.id || null, baseConnectionUpdatedAt: current?.updated_at || null });
      res.json({ authorizationUrl: oauthService.buildAuthorizationUrl({ state: stateMaterial.state, challenge: pkce.challenge }) });
    } catch (error) { res.status(error.code === 'GMAIL_OAUTH_NOT_CONFIGURED' ? 503 : 400).json({ error: error.publicMessage || error.message || 'Nao foi possivel iniciar a conexao Gmail.' }); }
  };
  router.get('/oauth/start', ...admin, startOAuth);
  router.post('/reconnect', ...admin, startOAuth);

  router.get('/oauth/callback', async (req, res) => {
    const state = String(req.query.state || '');
    try {
      if (!state || !/^[A-Za-z0-9_-]{20,}$/.test(state)) throw Object.assign(new Error('State OAuth invalido.'), { code: 'GMAIL_OAUTH_STATE_INVALID' });
      const stateHash = crypto.createHash('sha256').update(state, 'utf8').digest('hex');
      const pending = await repo.consumeOAuthState(pool, stateHash);
      const codeVerifier = pending?.code_verifier_ciphertext ? require('../services/integration-crypto').decryptSecret({ secret_ciphertext: pending.code_verifier_ciphertext, secret_iv: pending.code_verifier_iv, secret_auth_tag: pending.code_verifier_auth_tag })?.codeVerifier : null;
      if (!codeVerifier) throw Object.assign(new Error('PKCE OAuth ausente.'), { code: 'GMAIL_PKCE_MISSING' });
      const tokens = await oauthService.exchangeCode({ code: String(req.query.code || ''), codeVerifier });
      if (!tokens.refresh_token) throw Object.assign(new Error('O Google nao retornou refresh token.'), { code: 'GMAIL_REFRESH_TOKEN_MISSING' });
      const identity = await oauthService.identifyAccount(tokens.access_token);
      await repo.saveConnectedConnection(pool, { userId: pending.initiated_by_user_id, identity, refreshToken: tokens.refresh_token, scopes: oauthService.GMAIL_SCOPES, pendingState: pending });
      res.type('html').send(oauthResult('connected'));
    } catch (error) { res.type('html').send(oauthResult(error?.code === 'GMAIL_OAUTH_CANCELLED' ? 'cancelled' : 'error')); }
  });

  router.get('/status', ...admin, async (req, res) => {
    try { assertAdministrativeGmailAccess({ userId: req.userId, commercialUser: req.commercialUser }); res.json({ connection: publicGmailConnection(await repo.getCurrentConnection(pool)) }); }
    catch (error) { res.status(400).json({ error: error.message || 'Nao foi possivel consultar o Gmail.' }); }
  });

  router.post('/disconnect', ...admin, async (req, res) => {
    try { assertAdministrativeGmailAccess({ userId: req.userId, commercialUser: req.commercialUser }); const current = await repo.disconnectCurrentConnection(pool); let revocationConfirmed = true; if (current?.refresh_token_ciphertext) { try { await oauthService.revokeToken(oauthService.decryptRefreshToken(current)); } catch { revocationConfirmed = false; } } res.status(revocationConfirmed ? 200 : 202).json({ success: true, locallyDisconnected: true, revocationConfirmed, connection: null }); }
    catch (error) { res.status(400).json({ error: error.publicMessage || error.message || 'Nao foi possivel desconectar o Gmail.' }); }
  });

  return router;
}

module.exports = { createGmailRouter, gmailRouter: createGmailRouter() };
