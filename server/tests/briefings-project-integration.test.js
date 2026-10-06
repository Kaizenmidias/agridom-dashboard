const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const crud = fs.readFileSync(path.join(root, 'server/routes/crud.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database/migrations/20261006_shared_projects_briefings.sql'), 'utf8');
const briefingsPage = fs.readFileSync(path.join(root, 'src/pages/BriefingsPage.tsx'), 'utf8');

test('project creation uses one transaction for project and operational briefing', () => {
  assert.match(crud, /await connection\.beginTransaction\(\)/);
  assert.match(crud, /INSERT INTO projects/);
  assert.match(crud, /INSERT INTO briefings \(project_id/);
  assert.match(crud, /await connection\.commit\(\)/);
  assert.match(crud, /await connection\.rollback\(\)/);
});

test('projects and linked briefings are shared without removing authentication', () => {
  assert.match(crud, /router\.get\('\/projects', authenticateToken/);
  assert.match(crud, /requireModuleAccess\('can_access_projects'\)/);
  assert.match(crud, /SELECT \* FROM projects ORDER BY created_at DESC/);
  assert.match(crud, /FROM briefings b LEFT JOIN projects p ON p\.id = b\.project_id/);
  assert.match(crud, /project_id IS NOT NULL OR user_id = \?/);
  assert.match(crud, /requireModuleAccess\('can_access_briefings'\)/);
});

test('authorized user B can edit shared records without replacing original authorship', () => {
  assert.match(crud, /UPDATE projects[\s\S]+WHERE id = \?`/);
  assert.doesNotMatch(crud.match(/UPDATE projects[\s\S]+?router\.delete\('\/projects/s)?.[0] || '', /user_id = \?/);
  assert.match(crud, /UPDATE briefings[\s\S]+WHERE id = \? AND \(project_id IS NOT NULL OR user_id = \?\)/);
  assert.match(crud, /UPDATE users SET is_active/);
  assert.match(crud, /can_access_projects/);
  assert.match(crud, /can_access_briefings/);
});

test('migration links one briefing to each existing project idempotently', () => {
  assert.match(migration, /ADD COLUMN project_id BIGINT UNSIGNED NULL/);
  assert.match(migration, /UNIQUE KEY uq_briefings_project/);
  assert.match(migration, /INSERT INTO briefings \(project_id/);
  assert.match(migration, /LEFT JOIN briefings b ON b\.project_id = p\.id/);
  assert.match(migration, /WHERE b\.id IS NULL/);
});

test('briefings kanban persists drag and drop and renders project financial data', () => {
  assert.match(briefingsPage, /onDragStart=\{\(\) => setDraggedBriefing\(briefing\)\}/);
  assert.match(briefingsPage, /onDrop=\{\(\) => draggedBriefing && void handleMoveBriefing/);
  assert.match(briefingsPage, /updateBriefing\(id, \{ status: newStatus \}\)/);
  assert.match(briefingsPage, /briefing\.project_value/);
  assert.match(briefingsPage, /briefing\.project_name/);
});
