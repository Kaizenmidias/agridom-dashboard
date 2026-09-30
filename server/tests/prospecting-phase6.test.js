const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { CLASSIFICATIONS, normalizeStoredPayload, parseArgs, summarize } = require('../scripts/reprocess-prospecting-results');

const script = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'reprocess-prospecting-results.js'), 'utf8');

test('--job-id é obrigatório e dry-run é o padrão', () => {
  assert.throws(() => parseArgs([]), /--job-id/);
  assert.equal(parseArgs(['--job-id', 'cdbf9e8e-7732-4a87-a236-79278b25c656']).apply, false);
  assert.equal(parseArgs(['--job-id', 'cdbf9e8e-7732-4a87-a236-79278b25c656', '--apply']).apply, true);
});

test('normalização Compass usa title, categoryName, rating, reviews, site e URL', () => {
  const row = normalizeStoredPayload({ title: 'Empresa Real', categoryName: 'Accounting firm', totalScore: 4.8, reviewsCount: 12, website: 'https://empresa.example', url: 'https://maps.example/place', phoneUnformatted: '(11) 99999-0000', placeId: 'place-only' });
  assert.equal(row.company_name, 'Empresa Real');
  assert.equal(row.category, 'Accounting firm');
  assert.equal(row.rating, 4.8);
  assert.equal(row.review_count, 12);
  assert.equal(row.website, 'https://empresa.example');
  assert.equal(row.google_maps_url, 'https://maps.example/place');
  assert.equal(row.normalized_phone, '5511999990000');
});

test('identidade não usa placeId e não inventa email, Instagram ou WhatsApp', () => {
  const row = normalizeStoredPayload({ title: 'Sem contatos', placeId: 'place-only' });
  assert.equal(row.normalized_phone, null);
  assert.equal(row.email, null);
  assert.equal(row.instagram_url, null);
  assert.equal(row.phone, null);
});

test('resumo diferencia todas as classificações e memberships opcionais', () => {
  const items = Object.values(CLASSIFICATIONS).map((classification) => ({ classification }));
  const summary = summarize(items, { id: 7 });
  assert.deepEqual(summary, { analyzed: 5, alreadyLinked: 1, wouldCreate: 1, alreadyExists: 1, noPhone: 1, conflicts: 1, membershipsWouldCreate: 1 });
});

test('dry-run não contém escrita no caminho principal e não chama providers', () => {
  const main = script.slice(script.indexOf('async function main'));
  assert.doesNotMatch(main, /INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE/);
  assert.doesNotMatch(script, /fetch\(|Evolution|apifySearch|APIFY_TOKEN/i);
});

test('--apply reutiliza createOrFindProspect, preserva payload e é idempotente', () => {
  assert.match(script, /createOrFindProspect/);
  assert.match(script, /raw_payload/);
  assert.match(script, /INSERT IGNORE INTO lead_folder_members/);
  assert.match(script, /historical-reconciliation:/);
  assert.match(script, /prospect_id IS NULL/);
});

test('apply não tenta completar requested_quantity e evento só ocorre após commit', () => {
  assert.doesNotMatch(script, /requested_quantity.*(?:INSERT|fetch|loop)/i);
  assert.ok(script.indexOf('await connection.commit();') < script.indexOf("type: 'lead.added_to_folder'"));
  assert.match(script, /destination_folder_id/);
});
