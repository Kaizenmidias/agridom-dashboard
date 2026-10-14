const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "../..");
const page = fs.readFileSync(
  path.join(root, "src/pages/commercial/EmailMarketingPage.tsx"),
  "utf8",
);
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const navigation = fs.readFileSync(
  path.join(root, "src/config/navigation.ts"),
  "utf8",
);

test("email marketing keeps an independent route without replacing Disparar", () => {
  assert.match(
    app,
    /path: "\/comercial\/email-marketing", element: <EmailMarketingPage/,
  );
  assert.match(app, /path: "\/comercial\/disparar", element: <BroadcastPage/);
  assert.match(
    navigation,
    /label: "E-mail Marketing", icon: Mail, path: "\/comercial\/email-marketing"/,
  );
  assert.match(
    navigation,
    /label: "Disparar", icon: Send, path: "\/comercial\/disparar"/,
  );
});

test("email marketing reuses campaign providers, folders and draft APIs", () => {
  assert.match(page, /broadcastAPI\.list\(\)/);
  assert.match(page, /broadcastAPI\.emailProviders\(\)/);
  assert.match(page, /broadcastAPI\.folders\(\)/);
  assert.match(page, /broadcastAPI\.create\(/);
  assert.match(page, /broadcastAPI\.audienceFolders\(/);
  assert.match(page, /broadcastAPI\.content\(/);
  assert.doesNotMatch(page, /fetch\(|axios\./);
});

test("composer exposes real window states and does not simulate a Gmail inbox", () => {
  assert.match(page, /type ComposerSize = "normal" \| "minimized" \| "expanded"/);
  assert.match(page, /Minimizar compositor/);
  assert.match(page, /Expandir compositor/);
  assert.match(page, /Fechar compositor/);
  assert.match(page, /A leitura de mensagens Gmail ainda não está implementada/);
  assert.match(page, /Envio individual indisponível/);
  assert.doesNotMatch(page, /gmail.*inbox|messages\.list/i);
});

test("composer sanitizes formatted HTML before persisting the draft", () => {
  assert.match(page, /function sanitizeEmailHtml/);
  assert.match(page, /allowedTags/);
  assert.match(page, /\/\^\(https\?:\|mailto:\)\/i/);
  assert.match(page, /const safeHtml = sanitizeEmailHtml\(bodyHtml\)/);
  assert.match(page, /email_body_text: stripHtml\(safeHtml\)/);
});
