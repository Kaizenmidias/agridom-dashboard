const assert = require('assert');

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeBrazilianPhone(value) {
  let digits = onlyDigits(value);
  if (!digits) return '';
  digits = digits.replace(/^0+/, '');
  if (digits.startsWith('55')) {
    const national = digits.slice(2);
    return national.length >= 10 && national.length <= 11 ? digits : '';
  }
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return '';
}

function normalizeCnpj(value) {
  const digits = onlyDigits(value);
  return digits.length === 14 ? digits : '';
}

function normalizeEmail(value) {
  return value?.trim().toLowerCase() || '';
}

function normalizeWebsiteDomain(value) {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
  }
}

function normalizeInstagramUsername(value) {
  return (value || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .toLowerCase();
}

assert.equal(normalizeBrazilianPhone('(11) 99999-9999'), '5511999999999');
assert.equal(normalizeBrazilianPhone('+55 (11) 99999-9999'), '5511999999999');
assert.equal(normalizeBrazilianPhone('(11) 3333-4444'), '551133334444');
assert.equal(normalizeBrazilianPhone('123'), '');
assert.equal(normalizeBrazilianPhone(null), '');

assert.equal(normalizeCnpj('12.345.678/0001-90'), '12345678000190');
assert.equal(normalizeCnpj('123'), '');
assert.equal(normalizeEmail(' CONTATO@Empresa.COM '), 'contato@empresa.com');
assert.equal(normalizeWebsiteDomain('https://www.Exemplo.com.br/'), 'exemplo.com.br');
assert.equal(normalizeWebsiteDomain('www.kaizenmidias.com.br'), 'kaizenmidias.com.br');
assert.equal(normalizeInstagramUsername('https://instagram.com/KaizenMidias/?hl=pt'), 'kaizenmidias');
assert.equal(normalizeInstagramUsername('@KaizenMidias'), 'kaizenmidias');

console.log('prospecting-normalizers: ok');
