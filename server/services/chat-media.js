const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const MEDIA_ROOT = path.resolve(__dirname, '../storage/chat-media');
const LIMITS = Object.freeze({ image: 10 * 1024 * 1024, audio: 25 * 1024 * 1024, video: 50 * 1024 * 1024, document: 25 * 1024 * 1024, sticker: 2 * 1024 * 1024 });
const MIME_TYPES = Object.freeze({
  image: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  audio: new Set(['audio/ogg', 'audio/ogg; codecs=opus', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/webm', 'video/webm']),
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp']),
  document: new Set(['application/pdf', 'text/plain', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  sticker: new Set(['image/webp', 'image/png', 'video/webm'])
});
const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/wav': '.wav', 'audio/webm': '.webm', 'video/webm': '.webm', 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/3gpp': '.3gp', 'application/pdf': '.pdf', 'text/plain': '.txt', 'application/zip': '.zip' };

function mediaError(message, code) { return Object.assign(new Error(message), { code, publicMessage: message, retryable: false }); }
function normalizeMediaType(value) { return ['image', 'audio', 'video', 'document', 'sticker'].includes(value) ? value : null; }
function sniffMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) return 'application/pdf';
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 6).toString() === 'GIF89a' || buffer.subarray(0, 6).toString() === 'GIF87a') return 'image/gif';
  if (buffer.subarray(0, 4).toString() === 'PK\x03\x04') return 'application/zip';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WAVE') return 'audio/wav';
  if (buffer.subarray(4, 8).toString() === 'ftyp') return 'video/mp4';
  return null;
}
function validateMedia(type, mime, size) {
  const normalizedType = normalizeMediaType(type);
  const normalizedMime = String(mime || '').toLowerCase().split(';')[0].trim();
  if (!normalizedType || !MIME_TYPES[normalizedType].has(normalizedMime)) throw mediaError('Formato de arquivo nao suportado.', 'MEDIA_MIME_NOT_ALLOWED');
  if (!Number.isSafeInteger(size) || size < 1 || size > LIMITS[normalizedType]) throw mediaError('Este arquivo e muito grande.', 'MEDIA_SIZE_LIMIT');
  return { type: normalizedType, mime: normalizedMime, limit: LIMITS[normalizedType] };
}
function safeExtension(mime, fallback = '') { return EXTENSIONS[mime] || fallback; }
async function storeBuffer(buffer, { type, mime, filename = '' }) {
  const detected = sniffMime(buffer);
  const declared = String(mime || '').toLowerCase().split(';')[0].trim();
  const effectiveMime = detected || declared;
  const validation = validateMedia(type, effectiveMime, buffer.length);
  if (detected && declared !== detected && !(type === 'audio' && detected === 'video/webm')) throw mediaError('O conteudo do arquivo nao corresponde ao formato informado.', 'MEDIA_MIME_MISMATCH');
  await fsp.mkdir(MEDIA_ROOT, { recursive: true });
  const extension = safeExtension(validation.mime, path.extname(String(filename || '')).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 8));
  const generated = `${crypto.randomUUID()}${extension}`;
  const absolute = path.join(MEDIA_ROOT, generated);
  await fsp.writeFile(absolute, buffer, { flag: 'wx', mode: 0o600 });
  return { storagePath: generated, absolutePath: absolute, size: buffer.length, mime: validation.mime, type: validation.type, filename: String(filename || generated).replace(/[\\/\0]/g, '_').slice(0, 255) };
}
async function storeBase64(value, options) {
  const raw = String(value || '').replace(/^data:[^;]+;base64,/, '');
  let buffer;
  try { buffer = Buffer.from(raw, 'base64'); } catch { throw mediaError('Nao foi possivel processar a midia.', 'MEDIA_INVALID_BASE64'); }
  return storeBuffer(buffer, options);
}
function resolveStoragePath(storagePath) {
  const resolved = path.resolve(MEDIA_ROOT, String(storagePath || ''));
  if (resolved === MEDIA_ROOT || !resolved.startsWith(`${MEDIA_ROOT}${path.sep}`)) throw mediaError('Arquivo de midia invalido.', 'MEDIA_PATH_INVALID');
  return resolved;
}
async function removeMedia(storagePath) { if (!storagePath) return; await fsp.unlink(resolveStoragePath(storagePath)).catch((error) => { if (error.code !== 'ENOENT') throw error; }); }
function getMediaRange(range, size) {
  if (!range) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
  if (!match || (!match[1] && !match[2])) return 'invalid';
  let start = match[1] ? Number(match[1]) : Math.max(size - Number(match[2]), 0);
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) return 'invalid';
  end = Math.min(end, size - 1);
  return { start, end };
}
async function sendFile(req, res, file) {
  const absolute = resolveStoragePath(file.media_storage_path);
  const stat = await fsp.stat(absolute).catch(() => null);
  if (!stat?.isFile()) return res.status(404).json({ error: 'Arquivo de midia nao encontrado.' });
  const range = getMediaRange(req.headers.range, stat.size);
  if (range === 'invalid') return res.status(416).set('Content-Range', `bytes */${stat.size}`).end();
  res.set({ 'Accept-Ranges': 'bytes', 'Content-Type': file.media_mime_type || 'application/octet-stream', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.media_filename || 'arquivo')}`, 'X-Content-Type-Options': 'nosniff' });
  if (!range) { res.set('Content-Length', stat.size); return fs.createReadStream(absolute).pipe(res); }
  res.status(206).set({ 'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`, 'Content-Length': range.end - range.start + 1 });
  return fs.createReadStream(absolute, { start: range.start, end: range.end }).pipe(res);
}

module.exports = { MEDIA_ROOT, LIMITS, MIME_TYPES, normalizeMediaType, validateMedia, sniffMime, storeBuffer, storeBase64, resolveStoragePath, removeMedia, getMediaRange, sendFile };
