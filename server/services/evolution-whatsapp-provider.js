const axios = require('axios');
const { WEBHOOK_SECRET_HEADER } = require('./whatsapp-webhook-auth');

const clean = (value, fallback = 'EVOLUTION_ERROR') => String(value || fallback).replace(/[\r\n]+/g, ' ').replace(/[^a-zA-Z0-9_ .:@/-]/g, '').slice(0, 300);

function providerError(message, code, retryable = false, cause) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  error.publicMessage = message;
  error.providerDetail = clean(cause?.response?.data?.message || cause?.code || cause?.message, code);
  return error;
}

function validateBaseUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw providerError('URL base da Evolution invalida.', 'INVALID_EVOLUTION_BASE_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw providerError('URL base da Evolution invalida.', 'INVALID_EVOLUTION_BASE_URL');
  return url.toString().replace(/\/$/, '');
}

function normalizeState(value) {
  const state = String(value || '').toLowerCase();
  if (['open', 'connected', 'ready'].includes(state)) return 'connected';
  if (['connecting', 'pairing', 'qrcode'].includes(state)) return 'connecting';
  if (['close', 'closed', 'disconnected', 'logout'].includes(state)) return 'disconnected';
  return 'error';
}

class EvolutionWhatsAppProvider {
  constructor(config) {
    this.baseUrl = validateBaseUrl(config.baseUrl);
    this.apiKey = String(config.apiKey || '');
    if (!this.apiKey) throw providerError('API Key da Evolution nao configurada.', 'EVOLUTION_API_KEY_MISSING');
    this.timeout = Math.min(Math.max(Number(config.timeout || 15000), 3000), 30000);
  }

  async request(method, path, data) {
    try {
      const response = await axios({ method, url: `${this.baseUrl}${path}`, data, timeout: this.timeout, headers: { apikey: this.apiKey, 'Content-Type': 'application/json' }, validateStatus: () => true });
      if (response.status < 200 || response.status >= 300) {
        const auth = response.status === 401 || response.status === 403;
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw providerError(auth ? 'API Key da Evolution recusada.' : 'A Evolution recusou a operacao.', auth ? 'EVOLUTION_AUTH_FAILED' : retryable ? 'EVOLUTION_UNAVAILABLE' : 'EVOLUTION_REQUEST_FAILED', retryable, response);
      }
      return response.data || {};
    } catch (cause) {
      if (cause?.publicMessage) throw cause;
      const retryable = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(String(cause?.code));
      throw providerError('Nao foi possivel acessar a Evolution API.', retryable ? 'EVOLUTION_UNAVAILABLE' : 'EVOLUTION_REQUEST_FAILED', retryable, cause);
    }
  }

  async createInstance({ instanceName, webhookUrl }) {
    const data = await this.request('POST', '/instance/create', { instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true, webhookUrl: webhookUrl || undefined, webhookByEvents: false, webhookBase64: false, webhookEvents: webhookUrl ? ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'] : undefined });
    return { externalInstanceId: String(data.instance?.instanceName || data.instance?.instanceId || data.instanceName || instanceName), status: normalizeState(data.instance?.status || data.status), raw: data };
  }

  async setWebhook(instanceName, { url, secret }) {
    const data = await this.request('POST', `/webhook/set/${encodeURIComponent(instanceName)}`, { webhook: { enabled: true, url, byEvents: false, base64: false, headers: { [WEBHOOK_SECRET_HEADER]: secret }, events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'] } });
    return { raw: data };
  }

  async connect(instanceName) {
    const data = await this.request('GET', `/instance/connect/${encodeURIComponent(instanceName)}`);
    return { qrCode: data.base64 || data.qrcode?.base64 || data.code || null, pairingCode: data.pairingCode || null, raw: data };
  }

  async status(instanceName) {
    const data = await this.request('GET', `/instance/connectionState/${encodeURIComponent(instanceName)}`);
    return { status: normalizeState(data.instance?.state || data.state), raw: data };
  }

  async sendText(instanceName, number, text) {
    const data = await this.request('POST', `/message/sendText/${encodeURIComponent(instanceName)}`, { number, text: String(text), linkPreview: false });
    return { externalMessageId: data.key?.id || data.message?.key?.id || data.id || null, status: 'sent', raw: data };
  }

  async logout(instanceName) {
    const data = await this.request('DELETE', `/instance/logout/${encodeURIComponent(instanceName)}`);
    return { status: 'disconnected', raw: data };
  }
}

module.exports = { EvolutionWhatsAppProvider, normalizeState, validateBaseUrl, providerError };
