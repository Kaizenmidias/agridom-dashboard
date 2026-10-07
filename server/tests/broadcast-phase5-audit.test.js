const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("both campaigns finalize from channel jobs, not the shared recipient status", () => {
  const source = read("services/broadcast-campaign-worker.js");
  assert.match(source, /FROM broadcast_campaign_jobs WHERE campaign_id = \?/);
  assert.doesNotMatch(source.slice(source.indexOf("async function finalizeCampaign"), source.indexOf("async function materializeCampaign")), /FROM broadcast_campaign_recipients/);
});

test("email attachment worker fails closed when a private file is missing", () => {
  const source = read("services/broadcast-campaign-worker.js");
  assert.match(source, /assertAttachmentFile\(attachment\.storage_key\)/);
  assert.match(source, /emailSender\(config, \{ to: row\.recipient_email, subject, text, html: renderedHtml, attachments \}\)/);
});

test("migrations add independent columns and preserve WhatsApp defaults", () => {
  const foundation = read("../database/migrations/20261006_broadcast_multichannel_foundation.sql");
  const experience = read("../database/migrations/20261006_broadcast_email_experience.sql");
  const attachments = read("../database/migrations/20261006_broadcast_email_attachments.sql");
  assert.match(foundation, /channel VARCHAR\(20\) NOT NULL DEFAULT 'whatsapp'/);
  assert.match(foundation, /uq_broadcast_job_campaign_recipient_channel/);
  assert.match(experience, /COLUMN_NAME = 'email_signature_html'/);
  assert.match(experience, /COLUMN_NAME = 'email_signature_text'/);
  assert.match(attachments, /FOREIGN KEY \(campaign_id\)/);
  assert.doesNotMatch(attachments, /storage_path|public_url/i);
});

test("campaign attachment APIs expose only safe metadata and use authenticated campaign ownership", () => {
  const source = read("routes/broadcast-campaigns.js");
  assert.match(source, /router\.use\(authenticateToken, requireCommercialAccess\)/);
  assert.match(source, /removeEmailAttachment\(req\.params\.id, req\.params\.attachmentId/);
  assert.doesNotMatch(source, /configuration_metadata.*res\.json/);
});
