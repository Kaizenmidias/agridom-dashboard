const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dashboard',
  port: process.env.DB_PORT || 3306
};

async function initUsers() {
  let connection;
  
  try {
    console.log('🔧 Conectando ao banco MySQL...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Conectado ao banco!');
    
    // Verificar se já existe um admin
    const [adminRows] = await connection.execute(
      "SELECT * FROM users WHERE email = 'admin@agridom.com'"
    );
    
    if (adminRows.length === 0) {
      // Criar usuário admin
      const adminPassword = await bcrypt.hash('admin123', 10);
      
      await connection.execute(`
        INSERT INTO users (
          email, password, full_name, position, is_active,
          can_access_dashboard, can_access_briefings, can_access_codes,
          can_access_projects, can_access_expenses, can_access_crm, can_access_users
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'admin@agridom.com',
        adminPassword,
        'Administrador',
        'Administrador do Sistema',
        1, 1, 1, 1, 1, 1, 1, 1
      ]);
      
      console.log('✅ Usuário admin criado!');
      console.log('📧 Email: admin@agridom.com');
      console.log('🔑 Senha: admin123');
    } else {
      console.log('✅ Usuário admin já existe!');
    }
    
    // Verificar se já existe o usuário Ricardo
    const [ricardoRows] = await connection.execute(
      "SELECT * FROM users WHERE email = 'ricardo@agridom.com'"
    );
    
    if (ricardoRows.length === 0) {
      // Criar usuário Ricardo
      const ricardoPassword = await bcrypt.hash('ricardo123', 10);
      
      await connection.execute(`
        INSERT INTO users (
          email, password, full_name, position, is_active,
          can_access_dashboard, can_access_briefings, can_access_codes,
          can_access_projects, can_access_expenses, can_access_crm, can_access_users
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'ricardo@agridom.com',
        ricardoPassword,
        'Ricardo Silva',
        'Analista',
        1, 1, 1, 1, 1, 1, 1, 0
      ]);
      
      console.log('✅ Usuário Ricardo criado!');
      console.log('📧 Email: ricardo@agridom.com');
      console.log('🔑 Senha: ricardo123');
    } else {
      console.log('✅ Usuário Ricardo já existe!');
    }
    
    console.log('✅ Usuários inicializados com sucesso!');
    
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

initUsers();