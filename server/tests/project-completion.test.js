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

const calculateStats = (projects) => ({
  emAndamento: projects.filter((project) => project.status === 'active' || project.status === 'paused').length,
  finalizados: projects.filter((project) => project.status === 'completed').length,
  faturamentoTotal: projects
    .filter((project) => project.status === 'completed')
    .reduce((total, project) => total + (Number.isFinite(Number(project.project_value)) ? Number(project.project_value) : 0), 0),
  valorPendente: projects
    .filter((project) => project.status !== 'cancelled')
    .reduce((total, project) => total + Math.max(0,
      (Number.isFinite(Number(project.project_value)) ? Number(project.project_value) : 0) -
      (Number.isFinite(Number(project.paid_value)) ? Number(project.paid_value) : 0)), 0),
});

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
  assert.match(completionBranch, /paid_value = project_value/);
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

test('project indicators use total value by operational status, not paid value', () => {
  const stats = calculateStats([
    { status: 'active', project_value: 1000, paid_value: 250 },
    { status: 'paused', project_value: 500, paid_value: 0 },
    { status: 'completed', project_value: 900, paid_value: 0 },
    { status: 'completed', project_value: 700, paid_value: 700 },
    { status: 'cancelled', project_value: 400, paid_value: 100 },
  ]);

  assert.deepEqual(stats, { emAndamento: 2, finalizados: 2, faturamentoTotal: 1600, valorPendente: 2150 });
  assert.match(projectsPage, /faturamentoTotal: projects[\s\S]+filter\(\(project\) => project\.status === 'completed'\)/);
  assert.match(projectsPage, /valorPendente: projects[\s\S]+filter\(\(project\) => project\.status !== 'cancelled'\)/);
});

test('project indicators tolerate null and invalid project values', () => {
  const stats = calculateStats([
    { status: 'active', project_value: null, paid_value: 50 },
    { status: 'completed', project_value: 'invalid', paid_value: 20 },
    { status: 'completed', project_value: 300, paid_value: null },
  ]);

  assert.deepEqual(stats, { emAndamento: 1, finalizados: 2, faturamentoTotal: 300, valorPendente: 300 });
  assert.match(projectsPage, /Number\.isFinite\(numericValue\)/);
});

test('project indicators are recalculated from the current project list after mutations', () => {
  const initial = [{ status: 'active', project_value: 900, paid_value: 0 }];
  assert.deepEqual(calculateStats(initial), { emAndamento: 1, finalizados: 0, faturamentoTotal: 0, valorPendente: 900 });

  const completed = [{ status: 'completed', project_value: 900, paid_value: 0 }];
  assert.deepEqual(calculateStats(completed), { emAndamento: 0, finalizados: 1, faturamentoTotal: 900, valorPendente: 900 });
  assert.match(projectsPage, /const stats = calculateProjectStats\(projetos\)/);
  assert.match(projectsPage, /setProjetos\(prev => prev\.map/);
  assert.match(projectsPage, /await loadProjects\(\)/);
});
