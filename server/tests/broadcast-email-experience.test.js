const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeEmailHtml, htmlToText } = require('../services/broadcast-email-html');

test('email html mantém formatação segura e remove XSS', () => {
  const safe = sanitizeEmailHtml('<p><strong>Olá</strong> <a href="https://example.test">site</a></p><script>alert(1)</script><img src=x onerror=alert(1)>');
  assert.match(safe, /<strong>Ol/);
  assert.match(safe, /href="https:\/\/example\.test"/);
  assert.doesNotMatch(safe, /script|img|onerror|alert/);
});

test('email html remove javascript e gera fallback textual', () => {
  const safe = sanitizeEmailHtml('<a href="javascript:alert(1)">clique</a><h2>Oferta</h2><ul><li>Item</li></ul>');
  assert.doesNotMatch(safe, /javascript|alert/);
  assert.equal(htmlToText(safe), 'cliqueOferta\nItem');
});
