const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dashboard',
  port: process.env.DB_PORT || 3306
};

async function checkStructure() {
  let connection;
  
  try {
    console.log('🔧 Conectando ao banco MySQL...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Conectado ao banco!');
    
    // Verificar se a tabela users existe
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'users'"
    );
    
    if (tables.length === 0) {
      console.log('❌ Tabela users não existe!');
      return;
    }
    
    console.log('✅ Tabela users existe!');
    
    // Verificar estrutura da tabela
    const [columns] = await connection.execute(
      "DESCRIBE users"
    );
    
    console.log('\n📋 Estrutura da tabela users:');
    console.table(columns);
    
    // Verificar usuários existentes
    const [users] = await connection.execute(
      "SELECT id, email, full_name, position FROM users"
    );
    
    console.log('\n👥 Usuários existentes:');
    console.table(users);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Verifique se o servidor MySQL/MariaDB está rodando');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkStructure();