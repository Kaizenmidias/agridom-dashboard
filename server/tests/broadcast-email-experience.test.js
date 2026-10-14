const test = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizeEmailHtml,
  htmlToText,
} = require("../services/broadcast-email-html");

test("email html preserves safe formatting and removes XSS", () => {
  const safe = sanitizeEmailHtml(
    '<h2 style="color:#123456;text-align:center;position:fixed"><strong>Hello</strong></h2><a href="https://example.test">site</a><script>alert(1)</script>',
  );
  assert.match(safe, /<strong>Hello/);
  assert.match(safe, /href="https:\/\/example\.test"/);
  assert.match(safe, /color:#123456/);
  assert.match(safe, /text-align:center/);
  assert.doesNotMatch(safe, /script|position|alert/);
});

test("email html preserves only public HTTPS images", () => {
  const safe = sanitizeEmailHtml(
    '<img src="https://cdn.example.test/banner.jpg" alt="Offer" width="600" style="width:100%;max-width:600px" onerror="alert(1)"><img src="http://example.test/a.jpg"><img src="data:image/png;base64,abc">',
  );
  assert.match(safe, /src="https:\/\/cdn\.example\.test\/banner\.jpg"/);
  assert.match(safe, /alt="Offer"/);
  assert.match(safe, /max-width:600px/);
  assert.doesNotMatch(safe, /http:\/\/example|data:image|onerror|alert/);
});

test("email html preserves table CTA and rejects dangerous links", () => {
  const safe = sanitizeEmailHtml(
    '<table role="presentation"><tbody><tr><td style="background-color:#BEFA33;padding:12px 20px;border-radius:4px"><a href="https://example.test/offer" style="color:#101212;text-decoration:none">View offer</a></td></tr></tbody></table><a href="javascript:alert(1)">bad</a>',
  );
  assert.match(safe, /<table role="presentation">/);
  assert.match(safe, /background-color:#BEFA33/);
  assert.match(safe, /href="https:\/\/example\.test\/offer"/);
  assert.doesNotMatch(safe, /javascript|alert/);
});

test("email html removes javascript and creates a text fallback", () => {
  const safe = sanitizeEmailHtml(
    '<a href="javascript:alert(1)">click</a><h2>Offer</h2><ul><li>Item</li></ul>',
  );
  assert.doesNotMatch(safe, /javascript|alert/);
  assert.equal(htmlToText(safe), "clickOffer\nItem");
});
