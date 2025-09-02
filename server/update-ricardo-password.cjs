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

async function updateRicardoPassword() {
  let connection;
  
  try {
    console.log('🔧 Conectando ao banco MySQL...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Conectado ao banco!');
    
    // Gerar nova senha hash
    const newPassword = 'ricardo123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    console.log('🔑 Atualizando senha do Ricardo...');
    
    // Atualizar a senha do Ricardo
    const [result] = await connection.execute(
      "UPDATE users SET password_hash = ? WHERE email = 'ricardorpc11@gmail.com'",
      [hashedPassword]
    );
    
    if (result.affectedRows > 0) {
      console.log('✅ Senha do Ricardo atualizada com sucesso!');
      console.log('📧 Email: ricardorpc11@gmail.com');
      console.log('🔑 Nova senha: ricardo123');
      
      // Verificar se a nova senha funciona
      const [ricardoRows] = await connection.execute(
        "SELECT * FROM users WHERE email = 'ricardorpc11@gmail.com'"
      );
      
      if (ricardoRows.length > 0) {
        const ricardo = ricardoRows[0];
        const isValid = await bcrypt.compare(newPassword, ricardo.password_hash);
        
        if (isValid) {
          console.log('✅ Verificação: Nova senha está funcionando!');
        } else {
          console.log('❌ Verificação: Nova senha não está funcionando!');
        }
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

updateRicardoPassword();