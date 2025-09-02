const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function updateAdminPassword() {
  let connection;
  
  try {
    console.log('🔧 Atualizando senha do usuário administrador...');
    
    // Conectar ao banco de dados
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'agri_dom_dashboard'
    });
    
    console.log('✅ Conectado ao banco de dados');
    
    // Gerar hash da nova senha
    const newPassword = 'Beatriz@2908';
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    console.log(`🔐 Atualizando senha para: ${newPassword}`);
    
    // Atualizar a senha do administrador
    const [result] = await connection.execute(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [newPasswordHash, 'agenciakaizendesign@gmail.com']
    );
    
    if (result.affectedRows > 0) {
      console.log('✅ Senha do administrador atualizada com sucesso!');
      
      // Verificar se a nova senha funciona
      const [rows] = await connection.execute(
        'SELECT password_hash FROM users WHERE email = ?',
        ['agenciakaizendesign@gmail.com']
      );
      
      if (rows.length > 0) {
        const isValid = await bcrypt.compare(newPassword, rows[0].password_hash);
        console.log(`🔍 Verificação da nova senha: ${isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
      }
    } else {
      console.log('❌ Nenhum usuário foi atualizado. Verifique se o email está correto.');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateAdminPassword();