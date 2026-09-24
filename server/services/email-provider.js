const nodemailer = require('nodemailer');

const cleanError = (error) => String(error?.code || error?.responseCode || error?.message || 'SMTP_ERROR').replace(/[\r\n]+/g, ' ').replace(/[^a-zA-Z0-9_ .:@/-]/g, '').slice(0, 300);

function smtpError(message, code, retryable = false, cause) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  error.publicMessage = message;
  error.providerDetail = cleanError(cause || error);
  return error;
}

function validateEmailAddress(value, field) {
  const text = String(value || '').trim();
  if (!text || /[\r\n]/.test(text) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw smtpError(`Endereco de e-mail invalido: ${field}.`, 'INVALID_EMAIL_ADDRESS');
  return text;
}

function validateSmtpConfig(input) {
  const config = input || {};
  const host = String(config.host || '').trim();
  const port = Number(config.port);
  const security = String(config.security || (config.secure ? 'ssl' : 'auto')).toLowerCase();
  if (!host || /[\r\n/:\\]/.test(host) || /^(smtp|https?|file):/i.test(host)) throw smtpError('Servidor SMTP invalido.', 'INVALID_SMTP_HOST');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw smtpError('Porta SMTP invalida.', 'INVALID_SMTP_PORT');
  if (!['auto', 'ssl', 'starttls'].includes(security)) throw smtpError('Seguranca SMTP invalida.', 'INVALID_SMTP_SECURITY');
  const username = String(config.username || '').trim();
  if (!username) throw smtpError('Usuario SMTP obrigatorio.', 'INVALID_SMTP_USERNAME');
  const fromEmail = validateEmailAddress(config.fromEmail, 'from_email');
  const replyTo = config.replyTo ? validateEmailAddress(config.replyTo, 'reply_to') : null;
  if (!config.password) throw smtpError('Senha SMTP nao configurada.', 'SMTP_PASSWORD_MISSING');
  if (/[\r\n]/.test(String(config.fromName || ''))) throw smtpError('Nome do remetente invalido.', 'INVALID_FROM_NAME');
  return { host, port, security, secure: security === 'ssl', requireTLS: security === 'starttls', username, password: String(config.password), fromName: String(config.fromName || '').trim(), fromEmail, replyTo };
}

function createTransport(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

async function verifySmtp(config) {
  try {
    await createTransport(config).verify();
    return { success: true, provider: 'smtp' };
  } catch (cause) {
    const detail = cleanError(cause);
    const retryable = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(String(cause?.code));
    throw smtpError('Nao foi possivel conectar ao servidor SMTP.', retryable ? 'SMTP_TEMPORARY_FAILURE' : 'SMTP_CONNECTION_FAILED', retryable, detail);
  }
}

async function sendSmtp(config, message) {
  if (/[\r\n]/.test(String(message.subject || ''))) throw smtpError('Assunto de e-mail invalido.', 'INVALID_EMAIL_SUBJECT');
  const to = validateEmailAddress(message.to, 'to');
  try {
    const info = await createTransport(config).sendMail({
      from: config.fromName ? { name: config.fromName, address: config.fromEmail } : config.fromEmail,
      to,
      replyTo: message.replyTo || config.replyTo || undefined,
      subject: String(message.subject || '').trim(),
      text: String(message.text || ''),
    });
    return { success: true, provider: 'smtp', messageId: info.messageId, accepted: info.accepted || [], rejected: info.rejected || [] };
  } catch (cause) {
    const responseCode = Number(cause?.responseCode || 0);
    const retryable = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(String(cause?.code)) || (responseCode >= 400 && responseCode < 500);
    throw smtpError('Nao foi possivel enviar o e-mail.', retryable ? 'SMTP_TEMPORARY_FAILURE' : 'SMTP_SEND_FAILED', retryable, cause);
  }
}

module.exports = { validateEmailAddress, validateSmtpConfig, verifySmtp, sendSmtp, cleanError };
