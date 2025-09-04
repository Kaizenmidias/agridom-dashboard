const { getPool } = require('./config/database');

async function checkTableStructure() {
  const pool = getPool();
  
  try {
    console.log('🔍 Verificando estrutura da tabela users...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Colunas da tabela users:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    console.log('\n✅ Verificação concluída');
    
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura:', error.message);
  } finally {
    await pool.end();
    console.log('🔌 Conexão encerrada');
  }
}

checkTableStructure();