const bcrypt = require('bcrypt');
const { query, getDatabase } = require('./config/sqlite');

async function createUsers() {
  try {
    console.log('🚀 Iniciando criação de usuários no SQLite...');
    
    // Inicializar banco e aguardar criação da tabela
    const db = getDatabase();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
    
    // Hash das senhas
    const lucasPassword = await bcrypt.hash('123456', 10);
    const ricardoPassword = await bcrypt.hash('123456', 10);
    
    console.log('🔐 Senhas hasheadas com sucesso');
    
    // Remover usuários existentes com os mesmos emails
    await query('DELETE FROM users WHERE email IN (?, ?)', [
      'agenciakaizendesign@gmail.com',
      'ricardorpc11@gmail.com'
    ]);
    
    console.log('🗑️ Usuários existentes removidos');
    
    // Inserir Lucas como Administrador
    const lucasResult = await query(`
      INSERT INTO users (
        email, password, name, role, is_active,
        can_access_dashboard, can_access_briefings, can_access_codes,
        can_access_projects, can_access_expenses, can_access_crm, can_access_users
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'agenciakaizendesign@gmail.com',
      lucasPassword,
      'Lucas',
      'Administrador',
      1, // is_active
      1, // can_access_dashboard
      1, // can_access_briefings
      1, // can_access_codes
      1, // can_access_projects
      1, // can_access_expenses
      1, // can_access_crm
      1  // can_access_users
    ]);
    
    console.log('👤 Usuário Lucas (Administrador) criado com ID:', lucasResult.insertId);
    
    // Inserir Ricardo como Web Designer
    const ricardoResult = await query(`
      INSERT INTO users (
        email, password, name, role, is_active,
        can_access_dashboard, can_access_briefings, can_access_codes,
        can_access_projects, can_access_expenses, can_access_crm, can_access_users
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'ricardorpc11@gmail.com',
      ricardoPassword,
      'Ricardo',
      'Web Designer',
      1, // is_active
      1, // can_access_dashboard
      1, // can_access_briefings
      0, // can_access_codes
      1, // can_access_projects
      0, // can_access_expenses
      0, // can_access_crm
      0  // can_access_users
    ]);
    
    console.log('👤 Usuário Ricardo (Web Designer) criado com ID:', ricardoResult.insertId);
    
    // Verificar usuários criados
    const users = await query('SELECT id, email, name, role FROM users ORDER BY id');
    
    console.log('\n📋 Usuários no banco:');
    users.rows.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Nome: ${user.name}, Cargo: ${user.role}`);
    });
    
    console.log('\n✅ Usuários criados com sucesso!');
    console.log('🔑 Senha padrão para ambos: 123456');
    
  } catch (error) {
    console.error('❌ Erro ao criar usuários:', error.message);
  } finally {
    process.exit(0);
  }
}

createUsers();