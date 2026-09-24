const crypto = require('node:crypto');

function encryptionKey() {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!value) {
    const error = new Error('Chave de criptografia das integracoes nao configurada.');
    error.code = 'INTEGRATION_ENCRYPTION_KEY_MISSING';
    throw error;
  }
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}

function decryptSecret(record) {
  if (!record?.secret_ciphertext || !record.secret_iv || !record.secret_auth_tag) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(record.secret_iv, 'hex'));
  decipher.setAuthTag(Buffer.from(record.secret_auth_tag, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(record.secret_ciphertext, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}

module.exports = { encryptSecret, decryptSecret };
