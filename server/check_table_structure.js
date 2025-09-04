const { getPool } = require('./config/database');

async function checkTableStructure() {
  const pool = getPool();
  
  try {
    console.log('🔗 Conectando ao banco de dados...');
    
    // Verificar estrutura da tabela users
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Estrutura da tabela users:');
    if (tableStructure.rows.length === 0) {
      console.log('❌ Tabela users não encontrada!');
    } else {
      tableStructure.rows.forEach(column => {
        console.log(`- ${column.column_name}: ${column.data_type} (${column.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    }
    
    // Verificar se existem usuários na tabela
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`\n👥 Total de usuários na tabela: ${userCount.rows[0].count}`);
    
    // Listar usuários existentes
    const existingUsers = await pool.query('SELECT * FROM users LIMIT 5');
    console.log('\n📝 Usuários existentes (primeiros 5):');
    existingUsers.rows.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Nome: ${user.name || user.full_name}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura:', error.message);
  } finally {
    await pool.end();
    console.log('🔌 Conexão com banco de dados encerrada');
  }
}

// Executar o script
if (require.main === module) {
  checkTableStructure();
}

module.exports = { checkTableStructure };