const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const route = fs.readFileSync(path.join(__dirname, '../routes/conversations.js'), 'utf8');

test('manual chat sends use the communication account id instead of the conversation id', () => {
  assert.match(route, /ca\.id AS loaded_account_id/);
  assert.match(route, /const account = \{ \.\.\.conversation, id: Number\(conversation\.loaded_account_id\) \};/);
  assert.doesNotMatch(route, /account: conversation, leadId: conversation\.lead_id/);
});

test('chat database failures expose only sanitized diagnostic fields in server logs', () => {
  assert.match(route, /safeDatabaseError/);
  assert.match(route, /constraint: sqlMessage\.match/);
  assert.match(route, /referencedTable: sqlMessage\.match/);
  assert.doesNotMatch(route, /console\.error\([^\n]*sqlMessage/);
});
