const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAdminPassword() {
  let connection;
  
  try {
    console.log('🔍 Verificando dados do usuário administrador...');
    
    // Conectar ao banco de dados
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'agri_dom_dashboard'
    });
    
    console.log('✅ Conectado ao banco de dados');
    
    // Buscar o usuário administrador
    const [rows] = await connection.execute(
      'SELECT id, email, password_hash, full_name, position FROM users WHERE email = ?',
      ['agenciakaizendesign@gmail.com']
    );
    
    if (rows.length === 0) {
      console.log('❌ Usuário administrador não encontrado!');
      return;
    }
    
    const user = rows[0];
    console.log('✅ Usuário Administrador encontrado:');
    console.log('📋 Dados do usuário:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.full_name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Cargo: ${user.position}`);
    console.log(`   Hash da senha: ${user.password_hash}`);
    
    // Verificar se a senha é 'admin123'
    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare('admin123', user.password_hash);
    console.log(`\n🔐 Senha 'admin123' é válida: ${isValidPassword ? '✅ SIM' : '❌ NÃO'}`);
    
    if (!isValidPassword) {
      console.log('\n🔧 Atualizando senha para "admin123"...');
      const newPasswordHash = await bcrypt.hash('admin123', 10);
      
      await connection.execute(
        'UPDATE users SET password_hash = ? WHERE email = ?',
        [newPasswordHash, 'agenciakaizendesign@gmail.com']
      );
      
      console.log('✅ Senha atualizada com sucesso!');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAdminPassword();