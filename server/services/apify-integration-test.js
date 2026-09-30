const TEST_TIMEOUT_MS = 10000;

function safeMessage(value) {
  return String(value || '')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/token[=:]\s*[^\s,]+/gi, 'token=[redacted]')
    .slice(0, 240);
}

function publicFailure(status) {
  if (status === 401) return { status: 401, error: 'Token da Apify invalido.', code: 'APIFY_INVALID_TOKEN' };
  if (status === 403) return { status: 403, error: 'Token da Apify sem acesso ao Actor.', code: 'APIFY_ACTOR_FORBIDDEN' };
  if (status === 404) return { status: 404, error: 'Actor do Google Maps nao encontrado.', code: 'APIFY_ACTOR_NOT_FOUND' };
  if (status === 429) return { status: 429, error: 'Limite de requisicoes da Apify atingido.', code: 'APIFY_RATE_LIMITED' };
  if (status >= 500) return { status: 503, error: 'Apify indisponivel no momento.', code: 'APIFY_PROVIDER_UNAVAILABLE' };
  return { status: 502, error: 'Nao foi possivel acessar o Actor do Google Maps.', code: 'APIFY_PROVIDER_ERROR' };
}

async function testApifyActor({ token, actorId, fetchImpl = fetch, timeoutMs = TEST_TIMEOUT_MS }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const body = await response.text();
    let payload = {};
    try { payload = JSON.parse(body); } catch { /* resposta nao JSON */ }
    if (!response.ok) {
      const failure = publicFailure(response.status);
      const error = new Error(failure.error);
      Object.assign(error, failure, {
        actorId,
        providerStatus: response.status,
        providerErrorType: payload?.type || payload?.errorType || null,
        providerErrorCode: payload?.code || payload?.errorCode || null,
        providerMessage: safeMessage(payload?.error?.message || payload?.message || body),
        timeout: false,
      });
      throw error;
    }
    return { success: true };
  } catch (error) {
    if (String(error?.code || '').startsWith('APIFY_')) throw error;
    const timeoutError = error?.name === 'AbortError';
    const wrapped = new Error(timeoutError ? 'Tempo limite excedido ao acessar a Apify.' : 'Nao foi possivel validar a conexao com a Apify.');
    Object.assign(wrapped, {
      actorId,
      status: timeoutError ? 504 : 502,
      code: timeoutError ? 'APIFY_TIMEOUT' : 'APIFY_NETWORK_ERROR',
      providerStatus: null,
      providerErrorType: error?.name || 'NETWORK_ERROR',
      providerErrorCode: error?.code || null,
      providerMessage: safeMessage(error?.message),
      timeout: timeoutError,
    });
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { testApifyActor, safeMessage };
