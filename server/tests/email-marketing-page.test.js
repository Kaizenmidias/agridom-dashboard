const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "../..");
const page = fs.readFileSync(path.join(root, "src/pages/commercial/EmailMarketingPage.tsx"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const navigation = fs.readFileSync(path.join(root, "src/config/navigation.ts"), "utf8");
const editor = fs.readFileSync(path.join(root, "src/components/email-marketing/EmailVisualEditor.tsx"), "utf8");
const sanitizer = fs.readFileSync(path.join(root, "src/lib/email-html.ts"), "utf8");
const campaignRoutes = fs.readFileSync(path.join(root, "server/routes/broadcast-campaigns.js"), "utf8");

test("email marketing keeps independent navigation", () => {
  assert.match(app, /path: "\/comercial\/email-marketing", element: <EmailMarketingPage/);
  assert.match(app, /path: "\/comercial\/disparar", element: <BroadcastPage/);
  assert.match(navigation, /label: "E-mail Marketing", icon: Mail, path: "\/comercial\/email-marketing"/);
  assert.match(navigation, /label: "Disparar", icon: Send, path: "\/comercial\/disparar"/);
});

test("email marketing reuses campaign APIs", () => {
  for (const token of ["broadcastAPI.list()", "broadcastAPI.emailProviders()", "broadcastAPI.folders()", "broadcastAPI.create(", "broadcastAPI.audienceFolders(", "broadcastAPI.content("]) assert.match(page, new RegExp(token.replace(/[().]/g, "\\$&")));
  assert.doesNotMatch(page, /fetch\(|axios\./);
});

test("composer keeps supported states without simulating inbox", () => {
  assert.match(page, /type ComposerSize = "normal" \| "minimized" \| "expanded"/);
  assert.match(page, /Minimizar compositor/);
  assert.match(page, /Expandir compositor/);
  assert.match(page, /Fechar compositor/);
  assert.match(page, /A leitura de mensagens Gmail/);
  assert.match(page, /Envio individual indisponível|Envio individual indispon/);
  assert.doesNotMatch(page, /gmail.*inbox|messages\.list/i);
});

test("composer sanitizes and persists HTML safely", () => {
  assert.match(page, /<EmailVisualEditor/);
  assert.match(page, /emailHtmlToText\(safeHtml\)/);
  assert.match(page, /const safeHtml = sanitizeEmailHtml\(bodyHtml\)/);
  assert.match(sanitizer, /export function sanitizeEmailHtml/);
  assert.match(sanitizer, /ALLOWED_TAGS/);
  assert.match(sanitizer, /\^https:/);
  assert.match(campaignRoutes, /emailHtml: body\.email_html/);
  assert.match(page, /dangerouslySetInnerHTML=\{\{ __html: bodyHtml \}\}/);
});

test("visual editor uses TipTap and preserves supported formatting", () => {
  for (const token of ["useEditor(", "StarterKit", "toggleBold", "toggleItalic", "toggleUnderline", "toggleStrike", "setTextAlign", "toggleBulletList", "toggleOrderedList", "unsetAllMarks"]) assert.match(editor, new RegExp(token.replace(/[().]/g, "\\$&")));
  assert.doesNotMatch(editor, /document\.execCommand/);
  for (const token of ["Inserir imagem", "Inserir botão", "{{primeiro_nome}}", 'setPreview("desktop")', 'setPreview("mobile")', 'sandbox=""']) assert.match(editor, new RegExp(token.replace(/[().]/g, "\\$&")));
  assert.match(editor, /sanitizeEmailHtml/);
});

test("drafts reopen without replacing their audience", () => {
  assert.match(page, /Editar rascunho/);
  assert.match(page, /initialCampaign\?\.email_html/);
  assert.match(page, /broadcastAPI\.update\(existingDraftId/);
  assert.match(page, /initialCampaign\?\.selected_audience\?\.folder_ids/);
  assert.match(page, /if \(!existingDraftId \|\| audienceChanged\)/);
});
