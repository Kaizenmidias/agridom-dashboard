const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar ao banco de dados
const dbPath = path.join(__dirname, 'server', 'dashboard.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Testando permissões do usuário Ricardo...');

// Verificar as permissões do usuário Ricardo
db.get(`
  SELECT 
    name, 
    email, 
    position,
    can_access_dashboard,
    can_access_projects,
    can_access_briefings,
    can_access_codes,
    can_access_expenses,
    can_access_crm,
    can_access_users
  FROM users 
  WHERE name = 'ricardo'
`, (err, row) => {
  if (err) {
    console.error('❌ Erro ao buscar usuário Ricardo:', err.message);
    return;
  }
  
  if (!row) {
    console.log('❌ Usuário Ricardo não encontrado!');
    return;
  }
  
  console.log('✅ Usuário Ricardo encontrado:');
  console.log('📋 Dados do usuário:');
  console.log(`   Nome: ${row.name}`);
  console.log(`   Email: ${row.email}`);
  console.log(`   Cargo: ${row.position}`);
  console.log('🔐 Permissões:');
  console.log(`   Dashboard: ${row.can_access_dashboard ? '✅' : '❌'}`);
  console.log(`   Projetos: ${row.can_access_projects ? '✅' : '❌'}`);
  console.log(`   Briefings: ${row.can_access_briefings ? '✅' : '❌'}`);
  console.log(`   Códigos: ${row.can_access_codes ? '✅' : '❌'}`);
  console.log(`   Despesas: ${row.can_access_expenses ? '✅' : '❌'}`);
  console.log(`   CRM: ${row.can_access_crm ? '✅' : '❌'}`);
  console.log(`   Usuários: ${row.can_access_users ? '✅' : '❌'}`);
  
  // Verificar se as permissões estão corretas (apenas briefings e códigos)
  const expectedPermissions = {
    can_access_dashboard: false,
    can_access_projects: false,
    can_access_briefings: true,
    can_access_codes: true,
    can_access_expenses: false,
    can_access_crm: false,
    can_access_users: false
  };
  
  let permissionsCorrect = true;
  console.log('\n🎯 Verificando se as permissões estão corretas:');
  
  for (const [permission, expected] of Object.entries(expectedPermissions)) {
    const actual = Boolean(row[permission]);
    const isCorrect = actual === expected;
    
    if (!isCorrect) {
      permissionsCorrect = false;
      console.log(`   ❌ ${permission}: esperado ${expected}, atual ${actual}`);
    } else {
      console.log(`   ✅ ${permission}: ${actual}`);
    }
  }
  
  if (permissionsCorrect) {
    console.log('\n🎉 Todas as permissões estão corretas!');
  } else {
    console.log('\n⚠️  Algumas permissões precisam ser corrigidas.');
  }
  
  db.close();
});