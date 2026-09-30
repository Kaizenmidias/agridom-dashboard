const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const scriptPath = path.join(__dirname, '..', 'scripts', 'preflight-prospecting-lead-lifecycle.js');
const migrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', '20261002_prospecting_lead_lifecycle.sql');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');
const migrationSource = fs.readFileSync(migrationPath, 'utf8');
const { classifyPreflight } = require(scriptPath);

test('preflight classifies a clean database as SAFE', () => {
  assert.deepEqual(classifyPreflight({ duplicates: [], emptyCount: 0 }), {
    safe: true,
    duplicateGroups: 0,
    emptyNormalizedPhone: 0,
  });
});

test('preflight classifies duplicate normalized phones as UNSAFE', () => {
  const result = classifyPreflight({ duplicates: [{ total: 2 }], emptyCount: 0 });
  assert.equal(result.safe, false);
  assert.equal(result.duplicateGroups, 1);
});

test('preflight classifies empty normalized phones as UNSAFE and allows NULL', () => {
  assert.equal(classifyPreflight({ duplicates: [], emptyCount: 3 }).safe, false);
  assert.equal(classifyPreflight({ duplicates: [], emptyCount: null }).safe, true);
});

test('preflight source contains only read queries and no provider calls', () => {
  assert.match(scriptSource, /SELECT normalized_phone, COUNT\(\*\)/i);
  assert.match(scriptSource, /SELECT COUNT\(\*\) AS empty_normalized_phone/i);
  assert.doesNotMatch(scriptSource, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(scriptSource, /apify/i);
});

test('migration defines the lifecycle columns and referential actions', () => {
  assert.match(migrationSource, /UNIQUE KEY uq_prospects_normalized_phone \(normalized_phone\)/i);
  assert.match(migrationSource, /destination_folder_id BIGINT UNSIGNED NULL/i);
  assert.match(migrationSource, /prospect_id BIGINT UNSIGNED NULL/i);
  assert.match(migrationSource, /REFERENCES lead_folders\(id\)\s+ON DELETE SET NULL/i);
  assert.match(migrationSource, /REFERENCES prospects\(id\)\s+ON DELETE SET NULL/i);
  assert.doesNotMatch(migrationSource, /DELIMITER|CREATE PROCEDURE|SIGNAL SQLSTATE|START TRANSACTION/i);
});
