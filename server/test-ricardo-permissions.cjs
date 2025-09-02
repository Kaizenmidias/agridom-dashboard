const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agri_dom',
  port: process.env.DB_PORT || 3306
};

async function testRicardoPermissions() {
  let connection;
  
  try {
    console.log('🔍 Testando permissões do usuário Ricardo...');
    
    // Conectar ao banco de dados
    connection = await mysql.createConnection(dbConfig);
    
    // Verificar as permissões do usuário Ricardo
     const [rows] = await connection.execute(`
       SELECT 
         full_name, 
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
       WHERE full_name = 'ricardo'
     `);
    
    if (rows.length === 0) {
      console.log('❌ Usuário Ricardo não encontrado!');
      return;
    }
    
    const user = rows[0];
    
    console.log('✅ Usuário Ricardo encontrado:');
     console.log('📋 Dados do usuário:');
     console.log(`   Nome: ${user.full_name}`);
     console.log(`   Email: ${user.email}`);
     console.log(`   Cargo: ${user.position}`);
    console.log('🔐 Permissões:');
    console.log(`   Dashboard: ${user.can_access_dashboard ? '✅' : '❌'}`);
    console.log(`   Projetos: ${user.can_access_projects ? '✅' : '❌'}`);
    console.log(`   Briefings: ${user.can_access_briefings ? '✅' : '❌'}`);
    console.log(`   Códigos: ${user.can_access_codes ? '✅' : '❌'}`);
    console.log(`   Despesas: ${user.can_access_expenses ? '✅' : '❌'}`);
    console.log(`   CRM: ${user.can_access_crm ? '✅' : '❌'}`);
    console.log(`   Usuários: ${user.can_access_users ? '✅' : '❌'}`);
    
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
      const actual = Boolean(user[permission]);
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
    
  } catch (error) {
    console.error('❌ Erro ao testar permissões:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testRicardoPermissions();