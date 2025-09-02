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

async function checkUsersTable() {
  let connection;
  
  try {
    console.log('🔍 Verificando estrutura da tabela users...');
    
    // Conectar ao banco de dados
    connection = await mysql.createConnection(dbConfig);
    
    // Verificar estrutura da tabela
    const [rows] = await connection.execute('DESCRIBE users');
    
    console.log('📋 Estrutura da tabela users:');
    rows.forEach(row => {
      console.log(`   - ${row.Field} (${row.Type})`);
    });
    
    // Verificar alguns usuários
    console.log('\n👥 Usuários na tabela:');
    const [users] = await connection.execute('SELECT * FROM users LIMIT 5');
    
    if (users.length === 0) {
      console.log('   Nenhum usuário encontrado.');
    } else {
      users.forEach(user => {
        console.log(`   - ID: ${user.id}, Nome: ${user.full_name || user.name || 'N/A'}, Email: ${user.email}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkUsersTable();