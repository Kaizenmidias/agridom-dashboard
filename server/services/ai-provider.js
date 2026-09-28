const { decryptSecret } = require('./integration-crypto');
const { query } = require('../config/database');
const { encryptSecret } = require('./integration-crypto');

const PROVIDER_ERRORS = {
  notConfigured: 'AI_PROVIDER_NOT_CONFIGURED',
  timeout: 'AI_PROVIDER_TIMEOUT',
  rateLimit: 'AI_PROVIDER_RATE_LIMIT',
  invalidCredential: 'AI_PROVIDER_INVALID_CREDENTIALS',
  forbidden: 'AI_PROVIDER_FORBIDDEN',
  unavailable: 'AI_PROVIDER_UNAVAILABLE',
  invalidResponse: 'AI_PROVIDER_INVALID_RESPONSE',
  failed: 'AI_PROVIDER_FAILED',
};

const modelCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const SUPPORTED_PROVIDERS = ['openai', 'gemini'];

function providerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function getOpenAiKey() {
  const result = await query("SELECT secret_ciphertext, secret_iv, secret_auth_tag FROM integration_providers WHERE provider = 'openai' LIMIT 1");
  const rows = result.rows || [];
  if (rows[0]) {
    try {
      const secret = decryptSecret(rows[0]);
      if (secret?.apiKey) return secret.apiKey;
    } catch (_) {
      throw providerError(PROVIDER_ERRORS.notConfigured, 'A credencial da IA nao esta disponivel.');
    }
  }
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  throw providerError(PROVIDER_ERRORS.notConfigured, 'A credencial da IA nao esta configurada.');
}

async function getProviderKey(provider) {
  const result = await query('SELECT secret_ciphertext, secret_iv, secret_auth_tag FROM integration_providers WHERE provider = ? LIMIT 1', [provider]);
  const rows = result.rows || [];
  if (!rows[0]?.secret_ciphertext) return null;
  try { return decryptSecret(rows[0])?.apiKey || null; } catch { return null; }
}

function normalizeModels(provider, data) {
  const source = provider === 'gemini' ? (data.models || []) : (data.data || []);
  return source.map((model) => {
    const id = String(model.name || model.id || '').replace(/^models\//, '');
    const methods = model.supportedGenerationMethods || [];
    const compatible = provider === 'gemini' ? methods.includes('generateContent') : !/(embedding|moderation|transcri|tts|image|search|dall|whisper)/i.test(id);
    return { id, name: String(model.displayName || model.name || model.id || id), provider, compatible, capabilities: methods, metadata: { description: model.description || null, contextWindow: model.inputTokenLimit || null } };
  }).filter((model) => model.id && model.compatible);
}

async function listModels(provider, { refresh = false } = {}) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) throw providerError(PROVIDER_ERRORS.failed, 'Provedor de IA nao suportado.');
  const cached = modelCache.get(provider);
  if (!refresh && cached && cached.expiresAt > Date.now()) return cached.models;
  const apiKey = await getProviderKey(provider);
  if (!apiKey) throw providerError(PROVIDER_ERRORS.notConfigured, 'O provedor de IA nao esta configurado.');
  const url = provider === 'gemini' ? `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}` : 'https://api.openai.com/v1/models';
  let response;
  try { response = await fetch(url, { headers: provider === 'openai' ? { Authorization: `Bearer ${apiKey}` } : {}, signal: AbortSignal.timeout(15000) }); }
  catch (error) { if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') throw providerError(PROVIDER_ERRORS.timeout, 'O provedor demorou demais para responder.'); throw providerError(PROVIDER_ERRORS.unavailable, 'Nao foi possivel se comunicar com o provedor de IA.'); }
  if (response.status === 429) throw providerError(PROVIDER_ERRORS.rateLimit, 'O provedor de IA atingiu o limite de requisicoes.');
  if (response.status === 401) throw providerError(PROVIDER_ERRORS.invalidCredential, 'A credencial do provedor nao foi aceita.');
  if (response.status === 403) throw providerError(PROVIDER_ERRORS.forbidden, 'A credencial nao tem permissao para esta operacao.');
  if (response.status >= 500) throw providerError(PROVIDER_ERRORS.unavailable, 'O provedor esta indisponivel no momento.');
  if (!response.ok) throw providerError(PROVIDER_ERRORS.failed, 'Nao foi possivel validar o provedor.');
  let payload; try { payload = await response.json(); } catch { throw providerError(PROVIDER_ERRORS.invalidResponse, 'O provedor retornou uma resposta inesperada.'); }
  const models = normalizeModels(provider, payload);
  modelCache.set(provider, { models, expiresAt: Date.now() + CACHE_TTL_MS });
  return models;
}

function invalidateModelCache(provider) { if (provider) modelCache.delete(provider); else modelCache.clear(); }
async function testProvider(provider) { const models = await listModels(provider, { refresh: true }); return { success: true, provider, compatibleModels: models.length }; }
async function runGemini({ model, systemPrompt, messages, modelConfig = {} }) {
  const apiKey = await getProviderKey('gemini'); if (!apiKey) throw providerError(PROVIDER_ERRORS.notConfigured, 'O provedor de IA nao esta configurado.');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000), body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: messages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })), ...(Number.isFinite(Number(modelConfig.temperature)) ? { generationConfig: { temperature: Number(modelConfig.temperature) } } : {}) }) });
  if (response.status === 429) throw providerError(PROVIDER_ERRORS.rateLimit, 'O provedor de IA atingiu o limite de requisicoes.'); if (!response.ok) throw providerError(PROVIDER_ERRORS.failed, 'O provedor de IA nao respondeu corretamente.'); const data = await response.json(); const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''; const usage = data.usageMetadata || {}; return { content, inputTokens: Number(usage.promptTokenCount || 0), outputTokens: Number(usage.candidatesTokenCount || 0), totalTokens: Number(usage.totalTokenCount || 0), costAmount: calculateCost(modelConfig, Number(usage.promptTokenCount || 0), Number(usage.candidatesTokenCount || 0)) };
}
async function runProvider({ provider, ...options }) { if (provider === 'openai') return runOpenAi(options); if (provider === 'gemini') return runGemini(options); throw providerError(PROVIDER_ERRORS.failed, 'Provedor de IA nao suportado.'); }

function calculateCost(modelConfig, inputTokens, outputTokens) {
  const input = Number(modelConfig?.inputPriceUsdPer1k);
  const output = Number(modelConfig?.outputPriceUsdPer1k);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return (inputTokens / 1000) * input + (outputTokens / 1000) * output;
}

async function runOpenAi({ model, systemPrompt, messages, modelConfig = {}, timeoutMs = 30000 }) {
  const apiKey = await getOpenAiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        ...(Number.isFinite(Number(modelConfig.temperature)) ? { temperature: Number(modelConfig.temperature) } : {}),
        ...(Number.isFinite(Number(modelConfig.maxTokens)) ? { max_tokens: Number(modelConfig.maxTokens) } : {}),
      }),
    });
    if (response.status === 429) throw providerError(PROVIDER_ERRORS.rateLimit, 'O provedor de IA atingiu o limite de requisicoes.');
    if (!response.ok) throw providerError(PROVIDER_ERRORS.failed, 'O provedor de IA nao respondeu corretamente.');
    const data = await response.json();
    const usage = data.usage || {};
    return {
      content: String(data.choices?.[0]?.message?.content || ''),
      inputTokens: Number(usage.prompt_tokens || 0),
      outputTokens: Number(usage.completion_tokens || 0),
      totalTokens: Number(usage.total_tokens || 0),
      costAmount: calculateCost(modelConfig, Number(usage.prompt_tokens || 0), Number(usage.completion_tokens || 0)),
    };
  } catch (error) {
    if (error.name === 'AbortError') throw providerError(PROVIDER_ERRORS.timeout, 'A requisicao ao provedor de IA expirou.');
    throw error.code ? error : providerError(PROVIDER_ERRORS.failed, 'Nao foi possivel consultar o provedor de IA.');
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { PROVIDER_ERRORS, SUPPORTED_PROVIDERS, calculateCost, runOpenAi, runGemini, runProvider, listModels, testProvider, invalidateModelCache, getProviderKey, encryptSecret };
