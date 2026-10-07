const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("prospecção retorna somente leads novos vinculados ao job e sem raw payload", () => {
  const route = read("routes/prospecting.js");
  assert.match(route, /WHERE pr\.job_id = \? AND j\.created_by = \?/);
  assert.match(route, /pr\.prospect_id IS NOT NULL AND p\.owner_user_id = \?/);
  assert.match(route, /pr\.company_name/);
  assert.doesNotMatch(route.slice(route.indexOf("router.get('/jobs/:id/results'"), route.indexOf("router.post('/imports'")), /SELECT pr\.\*/);
  assert.match(route, /pr\.duplicate_status = 'new'/);
});

test("tela de prospecção mostra status final, resultados por execução e polling controlado", () => {
  const page = read("../src/pages/commercial/ProspectingPage.tsx");
  assert.match(page, /ProspectingRunStatus/);
  assert.match(page, /onClick=\{\(\) => onViewJob\(item\.id\)\}/);
  assert.match(page, /ACTIVE_PROSPECTING_STATUSES\.includes\(item\.status\)/);
  assert.match(page, /ACTIVE_PROSPECTING_STATUSES\.includes\(data\.job\.status\)/);
  assert.match(page, /data\.job\.status === 'completed'/);
  assert.match(page, /\['completed', 'failed', 'cancelled'\]/);
});
