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
const editor = fs.readFileSync(
  path.join(root, "src/components/email-marketing/EmailVisualEditor.tsx"),
  "utf8",
);
const sanitizer = fs.readFileSync(
  path.join(root, "src/lib/email-html.ts"),
  "utf8",
);
const campaignRoutes = fs.readFileSync(
  path.join(root, "server/routes/broadcast-campaigns.js"),
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

test("composer uses the visual editor and sanitizes HTML before persisting drafts", () => {
  assert.match(page, /<EmailVisualEditor/);
  assert.match(page, /emailHtmlToText\(safeHtml\)/);
  assert.match(page, /const safeHtml = sanitizeEmailHtml\(bodyHtml\)/);
  assert.match(sanitizer, /export function sanitizeEmailHtml/);
  assert.match(sanitizer, /ALLOWED_TAGS/);
  assert.match(sanitizer, /\^https:/);
  assert.match(campaignRoutes, /emailHtml: body\.email_html/);
  assert.match(page, /dangerouslySetInnerHTML=\{\{ __html: bodyHtml \}\}/);
  assert.match(page, /const bodyHtml = campaign\.email_html[\s\S]*sanitizeEmailHtml/);
});

test("visual editor exposes functional formatting, media, CTA, variables and previews", () => {
  for (const command of [
    "undo", "redo", "bold", "italic", "underline", "strikeThrough",
    "justifyLeft", "justifyCenter", "justifyRight", "insertUnorderedList",
    "insertOrderedList", "removeFormat",
  ]) {
    assert.match(editor, new RegExp(`command\\(\\"${command}\\"`));
  }
  assert.match(editor, /Inserir imagem/);
  assert.match(editor, /Inserir botão/);
  assert.match(editor, /\{\{primeiro_nome\}\}/);
  assert.match(editor, /setPreview\("desktop"\)/);
  assert.match(editor, /setPreview\("mobile"\)/);
  assert.match(editor, /sandbox=""/);
});

test("drafts can be reopened without replacing their audience implicitly", () => {
  assert.match(page, /Editar rascunho/);
  assert.match(page, /initialCampaign\?\.email_html/);
  assert.match(page, /broadcastAPI\.update\(existingDraftId/);
  assert.match(page, /initialCampaign\?\.selected_audience\?\.folder_ids/);
  assert.match(page, /if \(!existingDraftId \|\| audienceChanged\)/);
});
