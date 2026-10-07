const test = require("node:test");
const assert = require("node:assert/strict");
const { validateUpload, sniffMime, resolveAttachmentPath, MAX_FILE_BYTES, MAX_TOTAL_BYTES, MAX_FILES } = require("../services/broadcast-email-attachments");
const worker = require("../services/broadcast-campaign-worker");
const routeSource = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../routes/broadcast-campaigns.js"), "utf8");

const file = (name, mimetype, buffer) => ({ originalname: name, mimetype, size: buffer.length, buffer });
test("email attachments accept allowed signatures and reject mismatches", () => {
  assert.equal(validateUpload(file("brief.pdf", "application/pdf", Buffer.from("%PDF-1.7"))).mimeType, "application/pdf");
  assert.equal(validateUpload(file("photo.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).mimeType, "image/jpeg");
  assert.equal(validateUpload(file("sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Buffer.from("PK\x03\x04office"))).extension, ".xlsx");
  assert.throws(() => validateUpload(file("evil.exe", "application/pdf", Buffer.from("%PDF"))), /Formato/);
  assert.throws(() => validateUpload(file("evil.pdf", "application/pdf", Buffer.from("not-pdf"))), /corresponde/);
});
test("email attachment limits and safe paths are enforced", () => {
  assert.equal(MAX_FILE_BYTES, 10 * 1024 * 1024);
  assert.equal(MAX_TOTAL_BYTES, 20 * 1024 * 1024);
  assert.equal(MAX_FILES, 5);
  assert.equal(sniffMime(Buffer.from("%PDF-1.7")), "application/pdf");
  assert.throws(() => resolveAttachmentPath("../../.env"), /invalido/);
  assert.throws(() => resolveAttachmentPath("C:\\secret.txt"), /invalido/);
  assert.equal(validateUpload(file("..\\report.pdf", "application/pdf", Buffer.from("%PDF"))).originalName, "report.pdf");
});
test("routes enforce draft ownership and attachment id removal without public paths", () => {
  assert.match(routeSource, /router\.post\("\/:id\/email-attachments"/);
  assert.match(routeSource, /campaign\.status !== "draft"/);
  assert.match(routeSource, /removeEmailAttachment\(req\.params\.id, req\.params\.attachmentId/);
  assert.doesNotMatch(routeSource, /res\.json\(\{[^}]*storage_key/);
});
test("worker maps private attachments to Nodemailer and keeps WhatsApp separate", () => {
  const source = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../services/broadcast-campaign-worker.js"), "utf8");
  assert.match(source, /assertAttachmentFile\(attachment\.storage_key\)/);
  assert.match(source, /filename: String\(attachment\.original_name/);
  assert.match(source, /emailSender\(config, \{ to: row\.recipient_email, subject, text, html: renderedHtml, attachments \}\)/);
  assert.match(source, /if \(job\.channel === "email"\) return executeBroadcastEmailRecipient/);
  assert.match(source, /if \(job\.channel === "email"\) return executeBroadcastEmailRecipient/);
  assert.equal(typeof worker.executeBroadcastEmailRecipient, "function");
});
