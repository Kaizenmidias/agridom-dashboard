const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const ATTACHMENT_ROOT = path.resolve(__dirname, "../storage/broadcast-email-attachments");
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED = Object.freeze({
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"], ".jpeg": ["image/jpeg"], ".png": ["image/png"], ".webp": ["image/webp"],
  ".doc": ["application/msword"], ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls": ["application/vnd.ms-excel"], ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
});

function attachmentError(message, code, status = 400) {
  return Object.assign(new Error(message), { code, status, publicMessage: message });
}
function safeName(value) {
  const base = path.basename(String(value || "arquivo")).replace(/[\u0000-\u001f\u007f\\/]/g, "_").trim();
  return (base || "arquivo").slice(0, 255);
}
function extensionFor(name) { return path.extname(safeName(name)).toLowerCase(); }
function sniffMime(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.subarray(0, 4).equals(Buffer.from("%PDF"))) return "application/pdf";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) return "application/msword";
  if (buffer.subarray(0, 4).toString() === "PK\x03\x04") return "application/zip";
  return null;
}
function validateUpload(file) {
  const name = safeName(file?.originalname);
  const ext = extensionFor(name);
  const declared = String(file?.mimetype || "").toLowerCase().split(";")[0].trim();
  const accepted = ALLOWED[ext];
  if (!accepted || !accepted.includes(declared)) throw attachmentError("Formato de anexo nao permitido.", "EMAIL_ATTACHMENT_TYPE");
  const size = Number(file?.size ?? file?.buffer?.length ?? 0);
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_BYTES) throw attachmentError("Cada anexo pode ter no maximo 10 MB.", "EMAIL_ATTACHMENT_SIZE", 413);
  const detected = sniffMime(file.buffer);
  const officeZip = [".docx", ".xlsx"].includes(ext) && detected === "application/zip";
  if ([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc"].includes(ext) && !detected) throw attachmentError("O conteudo do anexo nao corresponde ao formato informado.", "EMAIL_ATTACHMENT_MIME_MISMATCH");
  if (detected && detected !== declared && !officeZip) throw attachmentError("O conteudo do anexo nao corresponde ao formato informado.", "EMAIL_ATTACHMENT_MIME_MISMATCH");
  return { originalName: name, extension: ext, mimeType: declared, size };
}
function resolveAttachmentPath(storageKey) {
  const resolved = path.resolve(ATTACHMENT_ROOT, String(storageKey || ""));
  if (resolved === ATTACHMENT_ROOT || !resolved.startsWith(`${ATTACHMENT_ROOT}${path.sep}`)) throw attachmentError("Arquivo de anexo invalido.", "EMAIL_ATTACHMENT_PATH_INVALID");
  return resolved;
}
async function assertAttachmentFile(storageKey) {
  const absolute = resolveAttachmentPath(storageKey);
  const stat = await fs.lstat(absolute).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) throw attachmentError("Arquivo de anexo nao encontrado.", "EMAIL_ATTACHMENT_MISSING", 409);
  return absolute;
}
async function storeAttachment(campaignId, file) {
  const valid = validateUpload(file);
  const folder = String(Number(campaignId));
  const storageKey = `${folder}/${crypto.randomUUID()}${valid.extension}`;
  const absolute = resolveAttachmentPath(storageKey);
  await fs.mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
  await fs.writeFile(absolute, file.buffer, { flag: "wx", mode: 0o600 });
  return { ...valid, storageKey, absolutePath: absolute };
}
async function removeAttachment(storageKey) { await fs.unlink(resolveAttachmentPath(storageKey)).catch((error) => { if (error.code !== "ENOENT") throw error; }); }
module.exports = { ATTACHMENT_ROOT, MAX_FILE_BYTES, MAX_TOTAL_BYTES, MAX_FILES, ALLOWED, safeName, sniffMime, validateUpload, resolveAttachmentPath, assertAttachmentFile, storeAttachment, removeAttachment };
