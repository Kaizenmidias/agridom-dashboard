const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const crud = fs.readFileSync(path.join(root, 'server/routes/crud.js'), 'utf8');
const projectsPage = fs.readFileSync(path.join(root, 'src/pages/ProjetosPage.tsx'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'database/schema.mysql.sql'), 'utf8');

const completionRoute = crud.match(/router\.put\('\/projects\/:id'[\s\S]+?router\.delete\('\/projects\/:id'/)?.[0] || '';
const completionBranch = completionRoute.match(/if \(isProjectCompletionRequest\(req\.body\)\) \{[\s\S]+?\n  \}\n\n  try \{/)?.[0] || '';
const frontendCompleteHandler = projectsPage.match(/const handleCompleteProject = async[\s\S]+?^  \};/m)?.[0] || '';

test('project completion stores a MySQL DATE compatible value', () => {
  assert.match(schema, /completion_date DATE NULL/);
  assert.match(crud, /const normalizeDateOnly = \(value\) => \{/);
  assert.match(crud, /toISOString\(\)\.slice\(0, 10\)/);
  assert.doesNotMatch(frontendCompleteHandler, /new Date\(\)\.toISOString\(\)/);
  assert.match(projectsPage, /getFullYear\(\)/);
  assert.match(projectsPage, /getMonth\(\) \+ 1/);
  assert.match(projectsPage, /getDate\(\)/);
  assert.match(frontendCompleteHandler, /completion_date: todayDateOnly\(\)/);
});

test('project completion preserves financial values and avoids revenue side effects', () => {
  assert.match(completionBranch, /UPDATE projects/);
  assert.match(completionBranch, /SET status = 'completed'/);
  assert.doesNotMatch(completionBranch, /paid_value\s*=/);
  assert.doesNotMatch(completionBranch, /INSERT INTO\s+(expenses|revenues|payments|cash|parcels)/i);
  assert.doesNotMatch(frontendCompleteHandler, /paid_value/);
});

test('project completion is idempotent and relationship-safe', () => {
  assert.match(completionBranch, /SELECT \* FROM projects WHERE id = \? FOR UPDATE/);
  assert.match(completionBranch, /currentProject\.status !== 'completed'/);
  assert.match(completionBranch, /completion_date = COALESCE\(completion_date, \?\)/);
  assert.match(completionBranch, /Projeto nao encontrado/);
});

test('project completion UI updates state and prevents repeated clicks', () => {
  assert.match(projectsPage, /const \[completingProjects, setCompletingProjects\]/);
  assert.match(frontendCompleteHandler, /if \(completingProjects\.includes\(projectId\)\) return/);
  assert.match(frontendCompleteHandler, /setProjetos\(prev => prev\.map/);
  assert.match(projectsPage, /disabled=\{completingProjects\.includes\(String\(projeto\.id\)\)\}/);
  assert.match(projectsPage, /Loader2/);
});

test('bulk project completion uses the same financial-preserving semantics', () => {
  const bulkHandler = projectsPage.match(/const handleBulkStatusChange = async[\s\S]+?^  \};/m)?.[0] || '';
  assert.match(bulkHandler, /newStatus === 'completed'/);
  assert.match(bulkHandler, /completion_date: todayDateOnly\(\)/);
  assert.doesNotMatch(bulkHandler, /paid_value/);
});
