const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "../..");
const service = require("../services/broadcast-campaign-service");
const routeSource = fs.readFileSync(
  path.join(root, "server/routes/broadcast-campaigns.js"),
  "utf8",
);
const pageSource = fs.readFileSync(
  path.join(root, "src/pages/commercial/EmailMarketingPage.tsx"),
  "utf8",
);
const apiSource = fs.readFileSync(
  path.join(root, "src/api/broadcast-campaigns.ts"),
  "utf8",
);
const workerSource = fs.readFileSync(
  path.join(root, "server/services/broadcast-campaign-worker.js"),
  "utf8",
);

test("latest explicit folder selection is recovered from persisted campaign events", () => {
  assert.deepEqual(
    service.parseAudienceFolderSelection([
      { metadata: JSON.stringify({ source: "folders", folder_ids: [7, "8", 7], replaced: true }) },
      { metadata: JSON.stringify({ source: "folders", folder_ids: [2], replaced: true }) },
    ]),
    { folderIds: [7, 8], recoverable: true },
  );
});

test("an explicit empty selection is preserved and does not revive an older folder", () => {
  assert.deepEqual(
    service.parseAudienceFolderSelection([
      { metadata: { source: "folders", folder_ids: [], replaced: true } },
      { metadata: { source: "folders", folder_ids: [4], replaced: true } },
    ]),
    { folderIds: [], recoverable: true },
  );
});

test("legacy additive folder events remain recoverable for existing drafts", () => {
  assert.deepEqual(
    service.parseAudienceFolderSelection([
      { metadata: { source: "folder", folder_id: 9 } },
      { metadata: { source: "folder", folder_id: 5 } },
    ]),
    { folderIds: [9, 5], recoverable: true },
  );
});

test("details return persisted folders, recipient totals and eligibility classes", () => {
  assert.match(routeSource, /selected_audience: selectedAudience/);
  assert.match(routeSource, /getAudienceSelection\(/);
  for (const field of [
    "total_selected",
    "email_valid",
    "email_eligible",
    "email_no_consent",
    "email_unsubscribed",
    "email_invalid",
    "recipient_total",
  ]) {
    assert.match(apiSource, new RegExp(`${field}: number`));
  }
  assert.match(routeSource, /router\.post\("\/audience\/folders\/preview"/);
  assert.match(apiSource, /previewFolders: \(folder_ids: number\[\]\)/);
  assert.match(pageSource, /broadcastAPI[\s\S]*\.previewFolders\(selectedFolderIds\)/);
  assert.match(pageSource, /contatos distintos nas listas/);
  assert.match(pageSource, /email_eligible/);
});

test("reopening a draft restores folders and content edits preserve recipients", () => {
  assert.match(pageSource, /initialCampaign\?\.selected_audience\?\.folder_ids \|\| \[\]/);
  assert.match(pageSource, /if \(!initialCampaign \|\| audienceChanged\)/);
  assert.match(pageSource, /setAudienceChanged\(true\)/);
  assert.match(pageSource, /audiencePreview\?\.total_selected/);
  assert.match(pageSource, /total: detail\.recipient_summary\.total/);
  const contentHandler = routeSource.slice(
    routeSource.indexOf('router.put("/:id/content"'),
    routeSource.indexOf('router.get("/:id/email-attachments"'),
  );
  assert.doesNotMatch(contentHandler, /broadcast_campaign_recipients|DELETE FROM/);
});

test("audience replacement remains explicit and worker still revalidates consent and suppression", () => {
  assert.match(routeSource, /router\.put\("\/:id\/audience"/);
  assert.match(routeSource, /DELETE FROM broadcast_campaign_recipients WHERE campaign_id = \?/);
  assert.match(routeSource, /email_marketing_consent/);
  assert.match(workerSource, /EMAIL_CONSENT_REQUIRED/);
  assert.match(workerSource, /broadcast_email_suppressions/);
  assert.match(workerSource, /EMAIL_SUPPRESSED/);
});

test("combined folder preview de-duplicates contacts before classifying eligibility", () => {
  const serviceSource = fs.readFileSync(
    path.join(root, "server/services/broadcast-campaign-service.js"),
    "utf8",
  );
  assert.match(serviceSource, /SELECT DISTINCT p\.id/);
  assert.match(serviceSource, /email_marketing_consent = 1 AND s\.id IS NULL/);
  assert.match(serviceSource, /s\.id IS NOT NULL/);
  assert.match(serviceSource, /SUM\(a\.email_valid = 0\) AS email_invalid/);
});
