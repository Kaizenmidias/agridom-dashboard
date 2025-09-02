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

async function addResetFields() {
  let connection;
  
  try {
    console.log('🔧 Conectando ao banco MySQL...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Conectado ao banco!');
    
    // Verificar se as colunas já existem
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM users LIKE 'reset_token'"
    );
    
    if (columns.length > 0) {
      console.log('✅ Colunas de reset já existem!');
      return;
    }
    
    console.log('🔧 Adicionando colunas de reset...');
    
    // Adicionar campo para token de recuperação
    await connection.execute(
      "ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL AFTER password_hash"
    );
    
    console.log('✅ Campo reset_token adicionado!');
    
    // Adicionar campo para expiração do token
    await connection.execute(
      "ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP NULL AFTER reset_token"
    );
    
    console.log('✅ Campo reset_token_expiry adicionado!');
    
    // Verificar a estrutura atualizada
    const [updatedColumns] = await connection.execute(
      "DESCRIBE users"
    );
    
    console.log('\n📋 Estrutura atualizada da tabela users:');
    updatedColumns.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type})`);
    });
    
    console.log('\n🎉 Campos de recuperação de senha adicionados com sucesso!');
    
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

addResetFields();