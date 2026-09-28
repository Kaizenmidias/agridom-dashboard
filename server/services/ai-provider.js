const { decryptSecret } = require('./integration-crypto');
const { query } = require('../config/database');

const PROVIDER_ERRORS = {
  notConfigured: 'AI_PROVIDER_NOT_CONFIGURED',
  timeout: 'AI_PROVIDER_TIMEOUT',
  rateLimit: 'AI_PROVIDER_RATE_LIMIT',
  failed: 'AI_PROVIDER_FAILED',
};

function providerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function getOpenAiKey() {
  const rows = await query("SELECT secret_ciphertext, secret_iv, secret_auth_tag FROM integration_providers WHERE provider = 'openai' LIMIT 1");
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

module.exports = { PROVIDER_ERRORS, calculateCost, runOpenAi };
