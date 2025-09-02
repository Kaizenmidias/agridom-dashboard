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

async function checkAdminPermissions() {
  let connection;
  
  try {
    console.log('🔍 Verificando permissões do usuário administrador...');
    
    // Conectar ao banco de dados
    connection = await mysql.createConnection(dbConfig);
    
    // Verificar as permissões do usuário administrador
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
      WHERE email = 'agenciakaizendesign@gmail.com'
    `);
    
    if (rows.length === 0) {
      console.log('❌ Usuário administrador não encontrado!');
      return;
    }
    
    const user = rows[0];
    
    console.log('✅ Usuário Administrador encontrado:');
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
    
    // Verificar se alguma permissão está como null ou false
    const permissions = {
      can_access_dashboard: user.can_access_dashboard,
      can_access_projects: user.can_access_projects,
      can_access_briefings: user.can_access_briefings,
      can_access_codes: user.can_access_codes,
      can_access_expenses: user.can_access_expenses,
      can_access_crm: user.can_access_crm,
      can_access_users: user.can_access_users
    };
    
    console.log('\n🔧 Análise das permissões:');
    let hasIssues = false;
    
    Object.entries(permissions).forEach(([key, value]) => {
      if (value === null || value === 0 || value === false) {
        console.log(`   ⚠️  ${key}: ${value} (BLOQUEADO)`);
        hasIssues = true;
      } else {
        console.log(`   ✅ ${key}: ${value}`);
      }
    });
    
    if (hasIssues) {
      console.log('\n❌ PROBLEMA IDENTIFICADO: O administrador tem permissões bloqueadas!');
      console.log('💡 Solução: Atualizar as permissões do administrador para true em todas as funcionalidades.');
    } else {
      console.log('\n✅ Todas as permissões do administrador estão corretas!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar permissões:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAdminPermissions();