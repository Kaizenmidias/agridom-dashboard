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

async function updateDatabase() {
  let connection;
  
  try {
    console.log('Conectando ao banco de dados...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('Adicionando coluna position...');
    try {
      await connection.execute('ALTER TABLE users ADD COLUMN position VARCHAR(255) NULL AFTER full_name');
      console.log('✅ Coluna position adicionada com sucesso!');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ Coluna position já existe');
      } else {
        throw error;
      }
    }
    
    console.log('Adicionando coluna bio...');
    try {
      await connection.execute('ALTER TABLE users ADD COLUMN bio TEXT NULL AFTER position');
      console.log('✅ Coluna bio adicionada com sucesso!');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ Coluna bio já existe');
      } else {
        throw error;
      }
    }
    
    console.log('Atualizando usuário admin com posição...');
    await connection.execute(
      "UPDATE users SET position = 'Administrador' WHERE email = 'admin@agridom.com'"
    );
    console.log('✅ Usuário admin atualizado!');
    
    console.log('Verificando estrutura da tabela...');
    const [rows] = await connection.execute('DESCRIBE users');
    console.log('Estrutura da tabela users:');
    console.table(rows);
    
    console.log('\n✅ Banco de dados atualizado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar banco de dados:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateDatabase();