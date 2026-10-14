const express = require("express");
const { query } = require("../config/database");

const router = express.Router();

router.get("/:token", async (req, res) => {
  const token = String(req.params.token || "");
  if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).send("Link de descadastro inválido.");
  try {
    const recipient = await query(
      "SELECT r.recipient_email, r.campaign_id FROM broadcast_campaign_recipients r WHERE r.unsubscribe_token = ? LIMIT 1",
      [token.toLowerCase()],
    );
    const row = recipient.rows?.[0];
    if (!row?.recipient_email) return res.status(404).send("Link de descadastro inválido ou expirado.");
    await query(
      "INSERT INTO broadcast_email_suppressions (email, reason, source_campaign_id) VALUES (?, 'unsubscribe', ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason)",
      [String(row.recipient_email).trim().toLowerCase(), row.campaign_id],
    );
    return res.type("html").send("<!doctype html><meta charset=\"utf-8\"><title>Descadastro confirmado</title><p>Seu descadastro foi confirmado. Você não receberá novas campanhas deste CRM.</p>");
  } catch (error) {
    console.error("[Broadcast] unsubscribe failed", { code: error?.code || "UNKNOWN" });
    return res.status(500).send("Não foi possível concluir o descadastro agora.");
  }
});

module.exports = router;
