const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("email consent requires explicit authorization fields and preserves suppression", () => {
  const route = fs.readFileSync(require.resolve("../routes/prospection"), "utf8");
  const migration = fs.readFileSync(require.resolve("../../database/migrations/20261014_broadcast_gmail_provider.sql"), "utf8");
  assert.match(route, /requireCommercialAdmin/);
  assert.match(route, /DESCADASTRO_EXIGE_REAUTORIZACAO_EXPLICITA/);
  assert.match(route, /email_marketing_consent_history/);
  assert.match(migration, /broadcast_email_suppressions/);
  assert.match(migration, /email_marketing_consent TINYINT\(1\) NOT NULL DEFAULT 0/);
});

test("campaign worker revalidates consent and suppression before sending", () => {
  const worker = fs.readFileSync(require.resolve("../services/broadcast-campaign-worker"), "utf8");
  assert.match(worker, /broadcast_email_suppressions/);
  assert.match(worker, /EMAIL_CONSENT_REQUIRED/);
  assert.match(worker, /status = 'skipped'/);
});
