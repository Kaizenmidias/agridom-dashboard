const mysql = require('mysql2/promise');

async function checkTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Beatriz@2908',
    database: 'dashboard'
  });

  try {
    console.log('Verificando estrutura da tabela users...');
    const [rows] = await connection.execute('DESCRIBE users');
    console.log('Estrutura da tabela users:');
    console.table(rows);
    
    console.log('\nVerificando se a tabela tem dados...');
    const [count] = await connection.execute('SELECT COUNT(*) as total FROM users');
    console.log('Total de usuários:', count[0].total);
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await connection.end();
  }
}

checkTable();