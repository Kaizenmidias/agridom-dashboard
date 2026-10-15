const test = require("node:test");
const assert = require("node:assert/strict");
const { executeBroadcastEmailRecipient } = require("../services/broadcast-campaign-worker");

test("broadcast email worker uses Gmail for a Gmail campaign and preserves idempotency", async () => {
  const calls = [];
  const connection = {
    async execute(sql) {
      calls.push(sql);
      if (sql.includes("SELECT c.*")) return [[{
        campaign_id: 10,
        campaign_email_provider: "gmail",
        email_subject: "Olá {{nome}}",
        email_body_text: "Mensagem",
        email_html: "",
        email_signature_html: "",
        recipient_id: 20,
        prospect_id: 30,
        recipient_email: "recipient@example.test",
        recipient_name: "Pessoa Teste",
        unsubscribe_token: "a".repeat(64),
        email_marketing_consent: 1,
        recipient_status: "processing",
      }]];
      if (sql.includes("SELECT id, status, provider_message_id")) return [[]];
      if (sql.includes("SELECT id, original_name")) return [[]];
      if (sql.startsWith("INSERT INTO communication_messages")) return [{ insertId: 99 }];
      return [{}];
    },
  };
  let gmailPayload;
  const result = await executeBroadcastEmailRecipient({
    connection,
    job: { campaign_id: 10, recipient_id: 20 },
    emailSender: async () => { throw new Error("SMTP must not be called"); },
    gmailSender: async (_pool, payload) => {
      gmailPayload = payload;
      return { messageId: "gmail-message-id" };
    },
  });
  assert.equal(result.success, true);
  assert.equal(gmailPayload.to, "recipient@example.test");
  assert.match(calls.find((sql) => sql.startsWith("INSERT INTO communication_messages")), /\?, 1\)/);
});

test("broadcast email worker preserves formatted campaign HTML and keeps text as fallback", async () => {
  const formattedHtml = '<p>First paragraph.</p><p>Second with <strong>bold</strong>.</p><p>Third.</p><ul><li>Item</li></ul><p><a href="https://example.test">Link</a></p>';
  const connection = {
    async execute(sql) {
      if (sql.includes("SELECT c.*")) return [[{
        campaign_id: 11,
        campaign_email_provider: "gmail",
        email_subject: "Formatted campaign",
        email_body_text: "First paragraph.\nSecond with bold.\nThird.\nItem\nLink",
        email_html: formattedHtml,
        email_signature_html: "",
        recipient_id: 21,
        prospect_id: 31,
        recipient_email: "recipient@example.test",
        recipient_name: "Test Person",
        unsubscribe_token: null,
        email_marketing_consent: 1,
        recipient_status: "processing",
      }]];
      if (sql.includes("SELECT id, status, provider_message_id")) return [[]];
      if (sql.includes("SELECT id, original_name")) return [[]];
      if (sql.startsWith("INSERT INTO communication_messages")) return [{ insertId: 100 }];
      return [{}];
    },
  };
  let gmailPayload;

  await executeBroadcastEmailRecipient({
    connection,
    job: { campaign_id: 11, recipient_id: 21 },
    gmailSender: async (_pool, payload) => {
      gmailPayload = payload;
      return { messageId: "gmail-formatted-message" };
    },
  });

  assert.match(gmailPayload.html, /<p>First paragraph\.<\/p>/);
  assert.match(gmailPayload.html, /<strong>bold<\/strong>/);
  assert.match(gmailPayload.html, /<ul><li>Item<\/li><\/ul>/);
  assert.match(gmailPayload.html, /href="https:\/\/example\.test"/);
  assert.match(gmailPayload.text, /First paragraph\.\nSecond with bold\./);
});
