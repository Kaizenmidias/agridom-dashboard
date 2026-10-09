const axios = require("axios");
const { WEBHOOK_SECRET_HEADER } = require("./whatsapp-webhook-auth");

const clean = (value, fallback = "EVOLUTION_ERROR") =>
  String(value || fallback)
    .replace(/[\r\n]+/g, " ")
    .replace(/[^a-zA-Z0-9_ .:@/-]/g, "")
    .slice(0, 300);
const safeProviderMessage = (value) =>
  clean(
    String(Array.isArray(value)
      ? value.map((item) => (typeof item === "object" ? item?.message || item?.error || "" : item)).join("; ")
      : typeof value === "object"
        ? value?.message || value?.error || ""
        : value || "")
      .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted]")
      .replace(/\b\d{7,}\b/g, "[redacted]")
      .replace(
        /(?:secret|api[_ -]?key|authorization|token|password|credential)[^\s,:;]*/gi,
        "[REDACTED]",
      ),
    "",
  );

const providerResponseData = (data) => {
  if (typeof data === "string" || Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return "";
  return data.message ?? data.response?.message ?? data.error?.message ?? data.error ?? data;
};

const providerRequestShape = (config) => {
  if (!config) return null;
  const payload = config.data && typeof config.data === "string" ? (() => { try { return JSON.parse(config.data); } catch { return {}; } })() : config.data || {};
  const number = payload.number == null ? "" : String(payload.number);
  const path = String(config.url || "").replace(/https?:\/\/[^/]+/i, "");
  return {
    endpoint: path.slice(0, 180),
    payloadKeys: Object.keys(payload).sort().slice(0, 20),
    hasNumber: Boolean(number),
    numberLength: number ? number.length : 0,
    numberCountryPrefix: number.startsWith("55") ? "55" : null,
    hasText: Boolean(payload.text),
    textLength: payload.text == null ? 0 : String(payload.text).length,
    instancePresent: /\/message\/[^/]+\/[^/]+/.test(path),
  };
};

function providerError(message, code, retryable = false, cause) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  error.publicMessage = message;
  error.providerStatus = Number.isInteger(cause?.status)
    ? cause.status
    : Number.isInteger(cause?.response?.status)
      ? cause.response.status
      : null;
  // Provider responses can echo credentials or message content; keep diagnostics code-only.
  error.providerDetail = clean(cause?.code || code, code);
  const data = cause?.response?.data;
  const responseData = providerResponseData(data);
  error.providerErrorCode = clean(
    (typeof data === "object" && !Array.isArray(data) ? data.code || data.errorCode : "") || "",
    "",
  );
  error.providerCode =
    error.providerErrorCode ||
    clean(typeof data === "object" && !Array.isArray(data) ? data.status || data.error?.code : "", "");
  error.providerErrorType = clean(
    typeof data === "object" && !Array.isArray(data) ? data.type || data.error?.type || data.error : "",
    "",
  );
  error.providerMessage = safeProviderMessage(responseData);
  error.providerRequestShape = providerRequestShape(cause?.config);
  error.operation = cause?.config
    ? `${String(cause.config.method || "").toUpperCase()} ${String(cause.config.url || "").replace(/https?:\/\/[^/]+/i, "")}`.slice(
        0,
        180,
      )
    : null;
  return error;
}

const messageId = (data) => data?.key?.id || data?.message?.key?.id || data?.id || null;

function requireMessageId(data) {
  const externalMessageId = typeof messageId(data) === "string" ? messageId(data).trim() : "";
  if (!externalMessageId) {
    throw providerError("A Evolution retornou uma resposta de mensagem invalida.", "EVOLUTION_INVALID_RESPONSE", false, { response: { data } });
  }
  return externalMessageId;
}

function validateBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw providerError(
      "URL base da Evolution invalida.",
      "INVALID_EVOLUTION_BASE_URL",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw providerError(
      "URL base da Evolution invalida.",
      "INVALID_EVOLUTION_BASE_URL",
    );
  return url.toString().replace(/\/$/, "");
}

function normalizeState(value) {
  const state = String(value || "").toLowerCase();
  if (["open", "connected", "ready"].includes(state)) return "connected";
  if (["connecting", "pairing", "qrcode"].includes(state)) return "connecting";
  if (["close", "closed", "disconnected", "logout"].includes(state))
    return "disconnected";
  return "error";
}

function normalizeIdentityPhone(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("@g.us") || raw.includes("@broadcast")) return null;
  const digits = raw.replace(/@s\.whatsapp\.net$|@c\.us$/i, "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

function extractIdentityCandidate(value) {
  if (!value || typeof value !== "object") return { phoneNumber: null, displayName: null };
  const candidates = [
    value,
    value.instance,
    value.instance?.profile,
    value.instance?.owner,
    value.profile,
    value.owner,
    value.user,
    value.me,
    value.data,
    value.response,
  ].filter(Boolean);
  for (const item of candidates) {
    const jid = item.ownerJid || item.owner || item.wuid || item.jid || item.id || item.number || item.phoneNumber || item.phone;
    const phoneNumber = normalizeIdentityPhone(jid);
    const displayName = String(item.profileName || item.pushName || item.name || item.displayName || item.verifiedName || "").trim() || null;
    if (phoneNumber || displayName) return { phoneNumber, displayName };
  }
  return { phoneNumber: null, displayName: null };
}

class EvolutionWhatsAppProvider {
  constructor(config) {
    this.baseUrl = validateBaseUrl(config.baseUrl);
    this.apiKey = String(config.apiKey || "");
    if (!this.apiKey)
      throw providerError(
        "API Key da Evolution nao configurada.",
        "EVOLUTION_API_KEY_MISSING",
      );
    this.timeout = Math.min(
      Math.max(Number(config.timeout || 15000), 3000),
      30000,
    );
    this.httpRequest = config.httpRequest || axios;
  }

  async request(method, path, data) {
    try {
      const response = await this.httpRequest({
        method,
        url: `${this.baseUrl}${path}`,
        data,
        timeout: this.timeout,
        headers: { apikey: this.apiKey, "Content-Type": "application/json" },
        validateStatus: () => true,
      });
      if (response.status < 200 || response.status >= 300) {
        const auth = response.status === 401 || response.status === 403;
        const retryable =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500;
        throw providerError(
          auth
            ? "API Key da Evolution recusada."
            : "A Evolution recusou a operacao.",
          auth
            ? "EVOLUTION_AUTH_FAILED"
            : retryable
              ? "EVOLUTION_UNAVAILABLE"
              : "EVOLUTION_HTTP_REJECTED",
          retryable,
          response,
        );
      }
      return response.data || {};
    } catch (cause) {
      if (cause?.publicMessage) throw cause;
      const transportCode = String(cause?.code || "");
      const retryable = ["EAI_AGAIN"].includes(transportCode);
      const code = transportCode === "ECONNABORTED" || transportCode === "ETIMEDOUT"
        ? "EVOLUTION_TIMEOUT"
        : transportCode === "ECONNRESET"
          ? "EVOLUTION_CONNECTION_RESET"
          : transportCode === "ECONNREFUSED"
            ? "EVOLUTION_CONNECTION_REFUSED"
            : retryable
              ? "EVOLUTION_UNAVAILABLE"
              : "EVOLUTION_REQUEST_FAILED";
      throw providerError(
        "Nao foi possivel acessar a Evolution API.",
        code,
        retryable,
        cause,
      );
    }
  }

  async createInstance({ instanceName, webhookUrl }) {
    const data = await this.request("POST", "/instance/create", {
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhookUrl: webhookUrl || undefined,
      webhookByEvents: false,
      webhookBase64: false,
      webhookEvents: webhookUrl
        ? ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
        : undefined,
    });
    return {
      externalInstanceId: String(
        data.instance?.instanceName ||
          data.instance?.instanceId ||
          data.instanceName ||
          instanceName,
      ),
      status: normalizeState(data.instance?.status || data.status),
      raw: data,
    };
  }

  async setWebhook(instanceName, { url, secret }) {
    const data = await this.request(
      "POST",
      `/webhook/set/${encodeURIComponent(instanceName)}`,
      {
        webhook: {
          enabled: true,
          url,
          byEvents: false,
          base64: false,
          headers: { [WEBHOOK_SECRET_HEADER]: secret },
          events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
        },
      },
    );
    return { raw: data };
  }

  async connect(instanceName) {
    const data = await this.request(
      "GET",
      `/instance/connect/${encodeURIComponent(instanceName)}`,
    );
    return {
      qrCode: data.base64 || data.qrcode?.base64 || data.code || null,
      pairingCode: data.pairingCode || null,
      raw: data,
    };
  }

  async status(instanceName) {
    const data = await this.request(
      "GET",
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    );
    return {
      status: normalizeState(data.instance?.state || data.state),
      identity: extractIdentityCandidate(data),
      raw: data,
    };
  }

  async fetchInstances() {
    const data = await this.request("GET", "/instance/fetchInstances");
    const payload = Array.isArray(data) ? data : Array.isArray(data?.instances) ? data.instances : Array.isArray(data?.data) ? data.data : [];
    return { instances: payload, raw: data };
  }

  async fetchInstance(instanceName) {
    const { instances, raw } = await this.fetchInstances();
    const wanted = String(instanceName || "");
    const found = instances.find((item) => {
      const name = item?.instanceName || item?.instance?.instanceName || item?.name || item?.id || item?.instance?.id;
      return String(name || "") === wanted;
    }) || null;
    return { exists: Boolean(found), identity: extractIdentityCandidate(found || raw), raw: found || raw };
  }

  async sendText(instanceName, number, text, quoted) {
    const data = await this.request(
      "POST",
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        number,
        text: String(text),
        linkPreview: false,
        ...(quoted ? { quoted } : {}),
      },
    );
    return {
      externalMessageId: requireMessageId(data),
      status: "sent",
      raw: data,
    };
  }

  async sendMedia(
    instanceName,
    { number, mediaType, mimeType, media, filename, caption, quoted },
  ) {
    const data = await this.request(
      "POST",
      `/message/sendMedia/${encodeURIComponent(instanceName)}`,
      {
        number,
        mediatype: mediaType,
        mimetype: mimeType,
        media,
        fileName: filename || undefined,
        caption: caption || undefined,
        quoted: quoted || undefined,
      },
    );
    return {
      externalMessageId: requireMessageId(data),
      status: "sent",
      raw: data,
    };
  }

  async sendAudio(instanceName, { number, audio, quoted }) {
    const data = await this.request(
      "POST",
      `/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`,
      { number, audio, encoding: true, quoted: quoted || undefined },
    );
    return {
      externalMessageId: requireMessageId(data),
      status: "sent",
      raw: data,
    };
  }

  async downloadMedia(instanceName, message, { convertToMp4 = false } = {}) {
    const data = await this.request(
      "POST",
      `/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`,
      { message, convertToMp4 },
    );
    return {
      base64: data.base64 || data.data?.base64 || data.message?.base64 || null,
      mimeType:
        data.mimetype ||
        data.mimeType ||
        data.data?.mimetype ||
        data.data?.mimeType ||
        null,
      filename: data.fileName || data.filename || data.data?.fileName || null,
      raw: data,
    };
  }

  async fetchProfilePicture(instanceName, number) {
    const data = await this.request(
      "POST",
      `/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`,
      { number },
    );
    return {
      profilePictureUrl:
        data.profilePictureUrl || data.picture || data.url || null,
    };
  }

  async findGroup(instanceName, groupJid) {
    const data = await this.request(
      "GET",
      `/group/findGroupInfos/${encodeURIComponent(instanceName)}?groupJid=${encodeURIComponent(groupJid)}`,
    );
    const payload = data?.response || data?.data || data || {};
    return {
      name: payload.subject || payload.name || null,
      profilePictureUrl:
        payload.pictureUrl || payload.profilePictureUrl || null,
    };
  }

  async findGroupParticipants(instanceName, groupJid) {
    const data = await this.request(
      "GET",
      `/group/participants/${encodeURIComponent(instanceName)}?groupJid=${encodeURIComponent(groupJid)}`,
    );
    const payload = data?.response || data?.data || data;
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload?.participants) ? payload.participants : [];
  }

  async logout(instanceName) {
    const data = await this.request(
      "DELETE",
      `/instance/logout/${encodeURIComponent(instanceName)}`,
    );
    return { status: "disconnected", raw: data };
  }
}

module.exports = {
  EvolutionWhatsAppProvider,
  normalizeState,
  validateBaseUrl,
  providerError,
  extractIdentityCandidate,
};
