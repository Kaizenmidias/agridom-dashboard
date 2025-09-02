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

async function checkRicardoPassword() {
  let connection;
  
  try {
    console.log('🔧 Conectando ao banco MySQL...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Conectado ao banco!');
    
    // Buscar o Ricardo
    const [ricardoRows] = await connection.execute(
      "SELECT * FROM users WHERE email = 'ricardorpc11@gmail.com'"
    );
    
    if (ricardoRows.length === 0) {
      console.log('❌ Ricardo não encontrado!');
      return;
    }
    
    const ricardo = ricardoRows[0];
    console.log('\n👤 Dados do Ricardo:');
    console.log('📧 Email:', ricardo.email);
    console.log('👤 Nome:', ricardo.full_name);
    console.log('💼 Cargo:', ricardo.position);
    
    // Testar senhas comuns
    const testPasswords = ['ricardo123', 'password', '123456', 'ricardo', 'Beatriz@2908'];
    
    console.log('\n🔑 Testando senhas...');
    
    for (const testPassword of testPasswords) {
      try {
        const isValid = await bcrypt.compare(testPassword, ricardo.password_hash);
        if (isValid) {
          console.log(`✅ Senha encontrada: ${testPassword}`);
          return;
        } else {
          console.log(`❌ Senha incorreta: ${testPassword}`);
        }
      } catch (error) {
        console.log(`❌ Erro ao testar senha ${testPassword}:`, error.message);
      }
    }
    
    console.log('\n❌ Nenhuma senha testada funcionou.');
    console.log('💡 Hash da senha no banco:', ricardo.password_hash);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkRicardoPassword();