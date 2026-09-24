const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'src/pages/UsuariosPage.tsx'), 'utf8');
const authContext = fs.readFileSync(path.join(root, 'src/contexts/AuthContext.tsx'), 'utf8');
const crud = fs.readFileSync(path.join(root, 'server/routes/crud.js'), 'utf8');

test('usuarios envia a senha no contrato do endpoint e recarrega a listagem apos criar', () => {
  assert.match(page, /password:\s*newUser\.password/);
  assert.doesNotMatch(page, /password_hash:\s*newUser\.password/);
  assert.match(authContext, /await loadUsuarios\(\)/);
  assert.doesNotMatch(authContext, /if \(!import\.meta\.env\.DEV\)/);
});

test('endpoint de usuarios persiste senha protegida e retorna o registro criado', () => {
  assert.match(crud, /INSERT INTO users \(email, password, name, role/);
  assert.match(crud, /bcrypt\.hash/);
  assert.match(crud, /SELECT id, email, name, name AS full_name, role, is_active, created_at, updated_at FROM users WHERE id/);
});
