const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  materializeCampaign,
  providerCadenceSeconds,
} = require("../services/broadcast-campaign-worker");
const {
  normalizeScheduledAt,
} = require("../services/broadcast-campaign-service");

const root = path.join(__dirname, "../..");
const routeSource = fs.readFileSync(path.join(root, "server/routes/broadcast-campaigns.js"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "src/pages/commercial/EmailMarketingPage.tsx"), "utf8");
const apiSource = fs.readFileSync(path.join(root, "src/api/broadcast-campaigns.ts"), "utf8");

function createPool({ status = "draft", eligible = true, scheduled = false } = {}) {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push("BEGIN"); },
    async commit() { calls.push("COMMIT"); },
    async rollback() { calls.push("ROLLBACK"); },
    release() { calls.push("RELEASE"); },
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("FROM broadcast_campaigns c")) return [[{
        id: 41,
        status,
        channel: "email",
        email_provider: "gmail",
        content_type: "text",
        text_content: null,
        email_subject: "Assunto",
        email_body_text: "Conteudo",
        schedule_is_future: scheduled ? 1 : 0,
        scheduled_at: scheduled ? new Date("2026-11-05T15:00:00.000Z") : null,
        cadence_seconds: 0,
      }]];
      if (sql.includes("FROM broadcast_campaign_recipients r")) return [[{
        id: 51,
        recipient_email: "pessoa@example.test",
        recipient_phone: null,
        email_eligible: eligible ? 1 : 0,
      }]];
      if (sql.startsWith("INSERT INTO broadcast_campaign_jobs")) return [{ affectedRows: 1 }];
      if (sql.startsWith("UPDATE broadcast_campaigns SET status")) return [{ affectedRows: 1 }];
      if (sql.startsWith("INSERT INTO broadcast_campaign_events")) return [{ affectedRows: 1 }];
      return [{}];
    },
  };
  return {
    calls,
    pool: { async getConnection() { return connection; } },
  };
}

test("email campaign review exposes real eligibility and excluded contacts", () => {
  assert.match(routeSource, /getAudienceSelection\(campaign\.id, req\.userId\)/);
  assert.match(routeSource, /has_recipients: selectedAudience\.email_eligible > 0/);
  assert.match(pageSource, /Contatos exclu[ií]dos da campanha/);
  assert.match(pageSource, /nenhum contato possui e-mail v[aá]lido/);
  assert.match(pageSource, /review\.selected_audience\.email_eligible/);
});

test("immediate launch locks the draft, creates persistent jobs and commits once", async () => {
  const fixture = createPool();
  const result = await materializeCampaign({
    campaignId: 41,
    userId: 7,
    pool: fixture.pool,
    gmailConnectionLoader: async () => ({ status: "connected" }),
    forceImmediate: true,
  });

  assert.equal(result.status, "running");
  assert.equal(result.jobs, 1);
  assert.equal(fixture.calls.filter((call) => call === "COMMIT").length, 1);
  assert.equal(fixture.calls.filter((call) => call === "ROLLBACK").length, 0);
  assert.ok(fixture.calls.some((call) => call.sql?.includes("FOR UPDATE")));
  assert.ok(fixture.calls.some((call) => call.sql?.includes("uq_broadcast_job_campaign_recipient_channel") || call.sql?.includes("ON DUPLICATE KEY UPDATE")));
});

test("launch blocks a campaign whose recipients are no longer eligible", async () => {
  const fixture = createPool({ eligible: false });
  await assert.rejects(
    materializeCampaign({
      campaignId: 41,
      userId: 7,
      pool: fixture.pool,
      gmailConnectionLoader: async () => ({ status: "connected" }),
    }),
    (error) => error.code === "CAMPAIGN_NO_ELIGIBLE_RECIPIENTS" && error.status === 409,
  );
  assert.equal(fixture.calls.filter((call) => call === "ROLLBACK").length, 1);
});

test("a repeated or concurrent launch is rejected before creating another job", async () => {
  const fixture = createPool({ status: "running" });
  await assert.rejects(
    materializeCampaign({
      campaignId: 41,
      userId: 7,
      pool: fixture.pool,
      gmailConnectionLoader: async () => ({ status: "connected" }),
    }),
    (error) => error.code === "CAMPAIGN_ALREADY_STARTED" && error.status === 409,
  );
  assert.equal(fixture.calls.filter((call) => call.sql?.startsWith("INSERT INTO broadcast_campaign_jobs")).length, 0);
});

test("scheduled launch uses the persisted UTC instant and keeps jobs pending", async () => {
  const fixture = createPool({ scheduled: true });
  const result = await materializeCampaign({
    campaignId: 41,
    userId: 7,
    pool: fixture.pool,
    gmailConnectionLoader: async () => ({ status: "connected" }),
  });
  const jobInsert = fixture.calls.find((call) => call.sql?.startsWith("INSERT INTO broadcast_campaign_jobs"));

  assert.equal(result.status, "scheduled");
  assert.equal(jobInsert.params[3].toISOString(), "2026-11-05T15:00:00.000Z");
  assert.equal(normalizeScheduledAt("2026-11-05T15:00:00.000Z"), "2026-11-05 15:00:00");
});

test("email launch uses a configurable provider cadence", () => {
  assert.equal(providerCadenceSeconds({ email_provider: "gmail", cadence_seconds: 0 }), 2);
  assert.equal(providerCadenceSeconds({ email_provider: "gmail", cadence_seconds: 10 }), 10);
});

test("composer exposes review, confirmation, scheduling, pause and resume through existing APIs", () => {
  assert.match(pageSource, /Revisar envio/);
  assert.match(pageSource, /Confirma o enfileiramento imediato/);
  assert.match(pageSource, /Bras[ií]lia, GMT-3/);
  assert.match(pageSource, /broadcastAPI\.sendNow/);
  assert.match(pageSource, /broadcastAPI\.schedule/);
  assert.match(pageSource, /action: "pause" \| "resume"/);
  assert.match(pageSource, /setInterval\(\(\) => void load\(true\), 10000\)/);
  assert.match(apiSource, /sendNow:/);
  assert.match(apiSource, /schedule:/);
  assert.match(routeSource, /router\.post\("\/:id\/send-now"/);
  assert.match(routeSource, /router\.post\("\/:id\/schedule"/);
});

test("launch remains queued and never sends from the HTTP request", () => {
  const startSection = routeSource.slice(
    routeSource.indexOf('router.post("/:id/send-now"'),
    routeSource.indexOf('router.post("/:id/pause"'),
  );
  assert.match(startSection, /materializeCampaign/);
  assert.doesNotMatch(startSection, /sendGmail|sendSmtp|executeBroadcastEmailRecipient/);
});
