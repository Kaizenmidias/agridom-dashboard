const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.join(__dirname, "..", "..", "src", "pages", "commercial", "LeadsPage.tsx"), "utf8");

test("copia emails filtrados sem duplicados e sem valores inválidos", () => {
  assert.match(page, /getValidLeadEmails\(filteredLeads\)/);
  assert.match(page, /new Set<string>\(\)/);
  assert.match(page, /\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$/);
  assert.match(page, /emails\.join\(" , "\)|emails\.join\(", "\)/);
});

test("botão de copiar fica acessível no cabeçalho de E-mail", () => {
  assert.match(page, /title="Copiar e-mails"/);
  assert.match(page, /aria-label="Copiar e-mails"/);
  assert.match(page, /<Clipboard className=/);
});

test("a cópia não fica limitada aos leads paginados", () => {
  assert.match(page, /const paginatedLeads = filteredLeads\.slice/);
  assert.match(page, /getValidLeadEmails\(filteredLeads\)/);
  assert.doesNotMatch(page, /getValidLeadEmails\(paginatedLeads\)/);
});
