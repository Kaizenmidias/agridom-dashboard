const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar ao banco de dados
const dbPath = path.join(__dirname, 'dashboard.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Verificando dados do administrador...');

// Verificar os dados do administrador
db.get(`
  SELECT 
    email, 
    full_name,
    position,
    is_active
  FROM users 
  WHERE email = 'agenciakaizendesign@gmail.com'
`, (err, row) => {
  if (err) {
    console.error('❌ Erro ao buscar administrador:', err.message);
    return;
  }
  
  if (!row) {
    console.log('❌ Administrador não encontrado!');
    console.log('\n🔍 Listando todos os usuários:');
    
    db.all('SELECT email, full_name FROM users', (err, rows) => {
      if (err) {
        console.error('❌ Erro ao listar usuários:', err.message);
        return;
      }
      
      rows.forEach(user => {
        console.log(`   - ${user.full_name} (${user.email})`);
      });
      
      db.close();
    });
    return;
  }
  
  console.log('✅ Administrador encontrado:');
  console.log(`   Email: ${row.email}`);
  console.log(`   Nome: ${row.full_name}`);
  console.log(`   Cargo: ${row.position}`);
  console.log(`   Ativo: ${row.is_active ? 'Sim' : 'Não'}`);
  
  db.close();
});