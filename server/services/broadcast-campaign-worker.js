const { getPool, query } = require("../config/database");
const { sendWhatsAppContent, normalizePhone } = require("./whatsapp-service");
const fs = require("node:fs/promises");
const { resolveStoragePath } = require("./chat-media");
// account_status !== 'connected' remains a hard guard before any worker send.

const BACKOFF_MS = [5000, 30000, 120000];
const TERMINAL_RECIPIENT_STATUSES = [
  "sent",
  "delivered",
  "read",
  "failed",
  "skipped",
  "cancelled",
];
const safeError = (error) =>
  String(
    error?.publicMessage ||
      error?.code ||
      error?.message ||
      "BROADCAST_JOB_FAILED",
  )
    .replace(/[^A-Z0-9_.:-]/gi, "_")
    .slice(0, 500);
const safeWorkerError = (error) => ({
  name: String(error?.name || "Error").slice(0, 80),
  code: String(error?.code || "BROADCAST_JOB_FAILED").replace(/[^A-Z0-9_.:-]/gi, "_").slice(0, 100),
  stage: String(error?.stage || (error?.code === "DATABASE_UNDEFINED_BIND" ? "persistence" : "unknown")).replace(/[^A-Z0-9_.:-]/gi, "_").slice(0, 80),
  message: safeError(error),
  providerStatus: Number.isInteger(error?.providerStatus) ? error.providerStatus : null,
  providerOperation: error?.operation || null,
  providerMessage: error?.providerMessage || null,
  undefinedIndexes: Array.isArray(error?.undefinedIndexes) ? error.undefinedIndexes : null,
  parameterCount: Number.isInteger(error?.parameterCount) ? error.parameterCount : null,
});
const workerId = (value) =>
  String(
    value ||
      `broadcast-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
  ).slice(0, 100);
async function finalizeCampaign(connection, campaignId) {
  const [rows] = await connection.execute(
    "SELECT SUM(status IN ('pending', 'processing')) AS active, SUM(status = 'failed') AS failed FROM broadcast_campaign_recipients WHERE campaign_id = ?",
    [campaignId],
  );
  const state = rows[0] || {};
  if (Number(state.active || 0) === 0)
    await connection.execute(
      "UPDATE broadcast_campaigns SET status = IF(status IN ('cancelled', 'paused'), status, 'completed'), completed_at = IF(status IN ('cancelled', 'paused'), completed_at, UTC_TIMESTAMP()), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [campaignId],
    );
}

async function materializeCampaign({ campaignId, userId, now = new Date() }) {
  const campaignResult = await query(
    `SELECT c.*, cc.content_type, cc.text_content, ca.channel AS account_channel, ca.archived_at AS account_archived_at, ca.status AS account_status, ca.owner_user_id AS account_owner_user_id FROM broadcast_campaigns c
    LEFT JOIN broadcast_campaign_contents cc ON cc.campaign_id = c.id
    LEFT JOIN communication_accounts ca ON ca.id = c.communication_account_id
    WHERE c.id = ? AND c.created_by_user_id = ?`,
    [campaignId, userId],
  );
  const campaign = campaignResult.rows?.[0];
  if (!campaign)
    throw Object.assign(new Error("CAMPAIGN_NOT_FOUND"), {
      status: 404,
      code: "CAMPAIGN_NOT_FOUND",
    });
  if (campaign.status !== "draft")
    throw Object.assign(new Error("CAMPAIGN_NOT_EDITABLE"), {
      status: 409,
      code: "CAMPAIGN_NOT_EDITABLE",
    });
  if (!campaign.communication_account_id)
    throw Object.assign(new Error("CAMPAIGN_ACCOUNT_REQUIRED"), {
      status: 400,
      code: "CAMPAIGN_ACCOUNT_REQUIRED",
    });
  if (
    campaign.account_channel !== "whatsapp" ||
    campaign.account_archived_at ||
    campaign.account_status !== "connected" ||
    (campaign.account_owner_user_id != null &&
      Number(campaign.account_owner_user_id) !== Number(userId))
  )
    throw Object.assign(new Error("WHATSAPP_ACCOUNT_NOT_READY"), {
      status: 409,
      code: "WHATSAPP_ACCOUNT_NOT_READY",
    });
  if (
    !campaign.content_type ||
    (campaign.content_type === "text" &&
      !String(campaign.text_content || "").trim())
  )
    throw Object.assign(new Error("CAMPAIGN_CONTENT_REQUIRED"), {
      status: 400,
      code: "CAMPAIGN_CONTENT_REQUIRED",
    });
  const recipientResult = await query(
    "SELECT id FROM broadcast_campaign_recipients WHERE campaign_id = ? AND status = 'pending'",
    [campaign.id],
  );
  if (!recipientResult.rows?.length)
    throw Object.assign(new Error("CAMPAIGN_RECIPIENTS_REQUIRED"), {
      status: 400,
      code: "CAMPAIGN_RECIPIENTS_REQUIRED",
    });
  const availableAt =
    campaign.scheduled_at && new Date(campaign.scheduled_at) > now
      ? campaign.scheduled_at
      : now;
  const nextStatus =
    campaign.scheduled_at && new Date(campaign.scheduled_at) > now
      ? "scheduled"
      : "running";
  const cadenceSeconds = Math.max(0, Number(campaign.cadence_seconds || 0));
  const values = recipientResult.rows.map((recipient, index) => [
    campaign.id,
    recipient.id,
    new Date(new Date(availableAt).getTime() + cadenceSeconds * 1000 * index),
  ]);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let index = 0; index < values.length; index += 250) {
      const chunk = values.slice(index, index + 250);
      const placeholders = chunk.map(() => "(?, ?, ?, 'pending')").join(", ");
      await connection.execute(
        `INSERT INTO broadcast_campaign_jobs (campaign_id, recipient_id, available_at, status) VALUES ${placeholders} ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        chunk.flat(),
      );
    }
    await connection.execute(
      "UPDATE broadcast_campaigns SET status = ?, started_at = IF(? = 'running', COALESCE(started_at, UTC_TIMESTAMP()), started_at), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'",
      [nextStatus, nextStatus, campaign.id],
    );
    await connection.execute(
      "INSERT INTO broadcast_campaign_events (campaign_id, event_type, metadata, created_by_user_id) VALUES (?, ?, ?, ?)",
      [
        campaign.id,
        nextStatus === "scheduled" ? "scheduled" : "started",
        JSON.stringify({ jobs: recipientResult.rows.length }),
        userId,
      ],
    );
    await connection.commit();
    return {
      campaignId: Number(campaign.id),
      jobs: recipientResult.rows.length,
      status: nextStatus,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function claimNextBroadcastJob({
  currentWorkerId = workerId(),
  lockTimeoutMs = 86400000,
} = {}) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE broadcast_campaign_jobs SET status = 'pending', locked_at = NULL, locked_by = NULL, available_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP WHERE status = 'processing' AND locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND)",
      [Math.max(1, Math.ceil(lockTimeoutMs / 1000))],
    );
    const [rows] =
      await connection.execute(`SELECT j.*, c.status AS campaign_status, r.status AS recipient_status
      FROM broadcast_campaign_jobs j JOIN broadcast_campaigns c ON c.id = j.campaign_id
      JOIN broadcast_campaign_recipients r ON r.id = j.recipient_id
      WHERE j.status = 'pending' AND j.available_at <= UTC_TIMESTAMP() AND c.status IN ('scheduled', 'running')
      ORDER BY j.id LIMIT 1 FOR UPDATE SKIP LOCKED`);
    const job = rows[0];
    if (!job) {
      await connection.rollback();
      return null;
    }
    await connection.execute(
      "UPDATE broadcast_campaign_jobs SET status = 'processing', locked_by = ?, locked_at = UTC_TIMESTAMP(), attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
      [currentWorkerId, job.id],
    );
    await connection.execute(
      "UPDATE broadcast_campaign_recipients SET status = 'processing', last_attempt_at = UTC_TIMESTAMP(), attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
      [job.recipient_id],
    );
    await connection.commit();
    return {
      ...job,
      id: Number(job.id),
      campaign_id: Number(job.campaign_id),
      recipient_id: Number(job.recipient_id),
      attempt_count: Number(job.attempt_count) + 1,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const TEMPLATE_VARIABLES = new Set([
  "nome",
  "primeiro_nome",
  "telefone",
  "email",
  "responsavel",
  "empresa",
]);
function resolveCampaignTemplate(value, variables) {
  return String(value || "")
    .replace(/{{\s*([a-z_]+)\s*}}/gi, (match, name) => {
      const key = String(name).toLowerCase();
      if (!TEMPLATE_VARIABLES.has(key)) {
        const error = new Error(`INVALID_TEMPLATE_VARIABLE:${key}`);
        error.code = "INVALID_TEMPLATE_VARIABLE";
        error.retryable = false;
        throw error;
      }
      return variables[key] == null ? "" : String(variables[key]);
    })
    .replace(/{{[^}]+}}/g, () => {
      const error = new Error("INVALID_TEMPLATE_VARIABLE");
      error.code = "INVALID_TEMPLATE_VARIABLE";
      error.retryable = false;
      throw error;
    });
}

function classifyBroadcastError(error) {
  if (error?.retryable === true) return error;
  const retryableCodes = new Set([
    "EVOLUTION_UNAVAILABLE",
    "EVOLUTION_TIMEOUT",
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "WHATSAPP_ACCOUNT_NOT_CONNECTED",
  ]);
  error.retryable = retryableCodes.has(String(error?.code || "").toUpperCase());
  return error;
}

function broadcastErrorMessage(error) {
  const code = String(error?.code || "");
  if (code === "EVOLUTION_AUTH_FAILED")
    return "A autenticação da Evolution falhou.";
  if (code === "EVOLUTION_UNAVAILABLE")
    return "A Evolution recusou o envio temporariamente.";
  if (code === "EVOLUTION_REQUEST_FAILED")
    return "A Evolution recusou o envio.";
  if (code === "WHATSAPP_ACCOUNT_NOT_CONNECTED")
    return "A instância do WhatsApp está desconectada.";
  if (code === "RECIPIENT_PHONE_INVALID")
    return "O número de destino é inválido.";
  if (code.startsWith("MEDIA_")) return "Não foi possível enviar a mídia.";
  return String(
    error?.publicMessage || error?.message || code || "Falha no envio.",
  )
    .replace(/_/g, " ")
    .slice(0, 500);
}

async function executeBroadcastRecipient({ connection, job } = {}) {
  if (!connection || !job) {
    const error = new Error("EXECUTOR_NOT_CONFIGURED");
    error.code = "EXECUTOR_NOT_CONFIGURED";
    error.retryable = false;
    throw error;
  }
  const [rows] = await connection.execute(
    `SELECT c.*, cc.content_type, cc.text_content, cc.media_storage_path, cc.mime_type, cc.original_filename,
      r.prospect_id, r.recipient_phone, r.recipient_name, r.status AS recipient_status,
      p.business_name AS prospect_business_name, p.email AS prospect_email, p.phone AS prospect_phone,
      u.name AS responsible_name, u.email AS responsible_email,
      ca.id AS account_id, ca.channel AS account_channel, ca.provider AS account_provider, ca.status AS account_status,
      ca.archived_at AS account_archived_at, ca.owner_user_id AS account_owner_user_id, ca.integration_provider_id, ca.external_instance_id
    FROM broadcast_campaigns c
    JOIN broadcast_campaign_contents cc ON cc.campaign_id = c.id
    JOIN broadcast_campaign_recipients r ON r.campaign_id = c.id
    LEFT JOIN prospects p ON p.id = r.prospect_id
    LEFT JOIN users u ON u.id = p.assigned_user_id
    JOIN communication_accounts ca ON ca.id = c.communication_account_id
    WHERE c.id = ? AND r.id = ? LIMIT 1`,
    [job.campaign_id, job.recipient_id],
  );
  const row = rows[0];
  if (!row) {
    const error = new Error("BROADCAST_CONTEXT_NOT_FOUND");
    error.code = "BROADCAST_CONTEXT_NOT_FOUND";
    error.retryable = false;
    throw error;
  }
  if (
    row.account_channel !== "whatsapp" ||
    row.account_provider !== "evolution" ||
    row.account_archived_at ||
    Number(row.account_owner_user_id) !== Number(row.created_by_user_id)
  ) {
    const error = new Error("WHATSAPP_ACCOUNT_INVALID");
    error.code = "WHATSAPP_ACCOUNT_INVALID";
    error.retryable = false;
    throw error;
  }
  if (row.recipient_status !== "processing") {
    const error = new Error("RECIPIENT_NOT_PROCESSING");
    error.code = "RECIPIENT_NOT_PROCESSING";
    error.retryable = false;
    throw error;
  }
  const phone = normalizePhone(row.recipient_phone);
  if (!phone) {
    const error = new Error("RECIPIENT_PHONE_INVALID");
    error.code = "RECIPIENT_PHONE_INVALID";
    error.retryable = false;
    throw error;
  }
  if (row.content_type !== "text" && !row.media_storage_path) {
    const error = new Error("CAMPAIGN_MEDIA_NOT_AVAILABLE");
    error.code = "CAMPAIGN_MEDIA_NOT_AVAILABLE";
    error.retryable = false;
    throw error;
  }
  const name = String(row.recipient_name || row.prospect_business_name || "");
  const variables = {
    nome: name,
    primeiro_nome: name.trim().split(/\s+/)[0] || "",
    telefone: row.recipient_phone,
    email: row.prospect_email || "",
    responsavel: row.responsible_name || row.responsible_email || "",
    empresa: row.prospect_business_name || name,
  };
  const text = resolveCampaignTemplate(row.text_content, variables);
  if (row.content_type === "text" && !text.trim()) {
    const error = new Error("CAMPAIGN_CONTENT_EMPTY");
    error.code = "CAMPAIGN_CONTENT_EMPTY";
    error.retryable = false;
    throw error;
  }
  try {
    const file =
      row.content_type === "text"
        ? null
        : {
            buffer: await fs.readFile(
              resolveStoragePath(row.media_storage_path),
            ),
            mimetype: row.mime_type,
            originalname: row.original_filename,
          };
    const result = await sendWhatsAppContent(connection, {
      account: {
        id: row.account_id,
        status: row.account_status,
        owner_user_id: row.account_owner_user_id,
        integration_provider_id: row.integration_provider_id,
        external_instance_id: row.external_instance_id,
        auto_create_leads: false,
      },
      leadId: row.prospect_id,
      recipient: phone,
      text,
      caption: text,
      messageType: row.content_type,
      file,
      mimeType: row.mime_type,
      filename: row.original_filename,
      idempotencyKey: `broadcast:${row.campaign_id}:${row.recipient_id}`,
    });
    if (!result.communicationMessageId || !result.providerMessageId) {
      const error = new Error("WHATSAPP_SEND_RESULT_INVALID");
      error.code = "WHATSAPP_SEND_RESULT_INVALID";
      error.retryable = false;
      throw error;
    }
    await connection.execute(
      "UPDATE broadcast_campaign_recipients SET communication_message_id = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [result.communicationMessageId, row.recipient_id],
    );
    return {
      success: true,
      communicationMessageId: result.communicationMessageId,
      providerMessageId: result.providerMessageId,
    };
  } catch (error) {
    throw classifyBroadcastError(error);
  }
}

async function processBroadcastJob(
  job,
  { executor = executeBroadcastRecipient, currentWorkerId = workerId() } = {},
) {
  const connection = await getPool().getConnection();
  try {
    const [currentRows] = await connection.execute(
      "SELECT j.*, c.status AS campaign_status, c.communication_account_id, cc.content_type FROM broadcast_campaign_jobs j JOIN broadcast_campaigns c ON c.id = j.campaign_id LEFT JOIN broadcast_campaign_contents cc ON cc.campaign_id = c.id WHERE j.id = ? AND j.status = 'processing' AND j.locked_by = ? FOR UPDATE",
      [job.id, currentWorkerId],
    );
    const current = currentRows[0];
    if (!current) return { skipped: true };
    if (["paused", "cancelled"].includes(current.campaign_status)) {
      await connection.execute(
        "UPDATE broadcast_campaign_jobs SET status = ?, processed_at = IF(? = 'cancelled', UTC_TIMESTAMP(), NULL), locked_at = NULL, locked_by = NULL WHERE id = ?",
        [
          current.campaign_status === "cancelled" ? "cancelled" : "pending",
          current.campaign_status,
          current.id,
        ],
      );
      await connection.execute(
        "UPDATE broadcast_campaign_recipients SET status = ? WHERE id = ? AND status = 'processing'",
        [
          current.campaign_status === "cancelled" ? "cancelled" : "pending",
          current.recipient_id,
        ],
      );
      await connection.commit();
      return { skipped: true };
    }
    if (current.campaign_status === "scheduled")
      await connection.execute(
        "UPDATE broadcast_campaigns SET status = 'running', started_at = COALESCE(started_at, UTC_TIMESTAMP()), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'scheduled'",
        [current.campaign_id],
      );
    try {
      const result = await (executor || executeBroadcastRecipient)({
        connection,
        job: current,
      });
      if (!result?.success)
        throw Object.assign(new Error("EXECUTOR_NO_SUCCESS"), {
          code: "EXECUTOR_NO_SUCCESS",
          retryable: false,
        });
      await connection.execute(
        "UPDATE broadcast_campaign_jobs SET status = 'completed', processed_at = UTC_TIMESTAMP(), locked_at = NULL, locked_by = NULL, last_error = NULL WHERE id = ?",
        [current.id],
      );
      await connection.execute(
        "UPDATE broadcast_campaign_recipients SET status = 'sent', sent_at = UTC_TIMESTAMP(), failed_at = NULL, last_error = NULL WHERE id = ?",
        [current.recipient_id],
      );
      await finalizeCampaign(connection, current.campaign_id);
      await connection.commit();
      return { completed: true };
    } catch (error) {
      const retryable = error?.retryable === true;
      console.error("[Broadcast] provider delivery failed", {
        campaign_id: Number(current.campaign_id),
        recipient_id: Number(current.recipient_id),
        communication_account_id:
          Number(current.communication_account_id || 0) || null,
        content_type: current.content_type || null,
        provider_http_status: error?.providerStatus || null,
        provider_error_code:
          error?.providerCode || error?.providerErrorCode || null,
        provider_operation: error?.operation || null,
        provider_message: error?.providerMessage || null,
        error_code: error?.code || null,
        error_name: safeWorkerError(error).name,
        error_stage: safeWorkerError(error).stage,
        error_message: safeWorkerError(error).message,
        undefined_indexes: safeWorkerError(error).undefinedIndexes,
        parameter_count: safeWorkerError(error).parameterCount,
        binding_operation: error?.bindingOperation || null,
        binding_fields: error?.bindingFields || null,
        operation:
          current.content_type === "text"
            ? "sendText"
            : current.content_type === "audio"
              ? "sendAudio"
              : "sendMedia",
        attempt: Number(current.attempt_count || 0),
        temporary: retryable,
      });
      const terminal =
        !retryable ||
        Number(current.attempt_count) >= Number(current.max_attempts);
      const delay =
        BACKOFF_MS[
          Math.min(
            Math.max(Number(current.attempt_count) - 1, 0),
            BACKOFF_MS.length - 1,
          )
        ];
      await connection.execute(
        `UPDATE broadcast_campaign_jobs SET status = ?, available_at = ${terminal ? "available_at" : "DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MICROSECOND)"}, locked_at = NULL, locked_by = NULL, last_error = ?, processed_at = ${terminal ? "UTC_TIMESTAMP()" : "NULL"} WHERE id = ?`,
        terminal
          ? ["failed", broadcastErrorMessage(error), current.id]
          : ["pending", delay * 1000, broadcastErrorMessage(error), current.id],
      );
      await connection.execute(
        "UPDATE broadcast_campaign_recipients SET status = ?, failed_at = IF(? = 'failed', UTC_TIMESTAMP(), NULL), last_error = ? WHERE id = ?",
        [
          terminal ? "failed" : "pending",
          terminal ? "failed" : "pending",
          broadcastErrorMessage(error),
          current.recipient_id,
        ],
      );
      await finalizeCampaign(connection, current.campaign_id);
      await connection.commit();
      return { failed: terminal, retrying: !terminal };
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function processBroadcastBatch({
  currentWorkerId = workerId(),
  batchSize = 10,
  executor,
} = {}) {
  let processed = 0;
  for (let index = 0; index < batchSize; index += 1) {
    const job = await claimNextBroadcastJob({ currentWorkerId });
    if (!job) break;
    try {
      await processBroadcastJob(job, { executor, currentWorkerId });
    } catch (error) {
      console.error("Broadcast job failed:", {
        job_id: job.id,
        code: safeError(error),
      });
    }
    processed += 1;
  }
  return processed;
}

module.exports = {
  BACKOFF_MS,
  TERMINAL_RECIPIENT_STATUSES,
  TEMPLATE_VARIABLES,
  resolveCampaignTemplate,
  classifyBroadcastError,
  broadcastErrorMessage,
  safeWorkerError,
  workerId,
  materializeCampaign,
  claimNextBroadcastJob,
  executeBroadcastRecipient,
  processBroadcastJob,
  processBroadcastBatch,
};
