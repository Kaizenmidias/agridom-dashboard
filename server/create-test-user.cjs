const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createTestUser() {
  let connection;
  
  try {
    // Criar conexão com o banco
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'agri_dom'
    });

    console.log('Conectado ao banco de dados MariaDB');

    // Hash da senha "123456"
    const passwordHash = await bcrypt.hash('123456', 10);

    // Inserir usuário de teste
    const [result] = await connection.execute(
      `INSERT INTO users (email, password_hash, full_name, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, true, NOW(), NOW()) 
       ON DUPLICATE KEY UPDATE 
       password_hash = VALUES(password_hash), 
       full_name = VALUES(full_name), 
       updated_at = NOW()`,
      ['admin@test.com', passwordHash, 'Administrador']
    );

    console.log('Usuário de teste criado/atualizado com sucesso!');
    console.log('Email: admin@test.com');
    console.log('Senha: 123456');
    
  } catch (error) {
    console.error('Erro ao criar usuário de teste:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createTestUser();