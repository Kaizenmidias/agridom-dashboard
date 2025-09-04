const bcrypt = require('bcrypt');
const { getPool } = require('./config/database');

async function createUsers() {
  const pool = getPool();
  
  try {
    console.log('🔗 Conectando ao banco de dados...');
    
    // Hash das senhas
    const lucasPasswordHash = await bcrypt.hash('Beatriz@2908', 10);
    const ricardoPasswordHash = await bcrypt.hash('@FDPfeioso90', 10);
    
    console.log('🔐 Senhas hasheadas com sucesso');
    
    // Primeiro, remover usuários existentes se houver
    await pool.query(`
      DELETE FROM users WHERE email IN ($1, $2)
    `, ['agenciakaizendesign@gmail.com', 'ricardorpc11@gmail.com']);
    
    console.log('🗑️ Usuários existentes removidos (se houver)');
    
    // Inserir usuário Lucas (Administrador)
    const lucasResult = await pool.query(`
      INSERT INTO users (
        email,
        password_hash,
        full_name,
        position,
        bio,
        avatar_url,
        is_active,
        can_access_dashboard,
        can_access_briefings,
        can_access_codes,
        can_access_projects,
        can_access_expenses,
        can_access_crm,
        can_access_users,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
      ) RETURNING id, email, full_name, position
    `, [
      'agenciakaizendesign@gmail.com',
      lucasPasswordHash,
      'Lucas',
      'Administrador',
      null,
      null,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true
    ]);
    
    console.log('✅ Usuário Lucas criado:', lucasResult.rows[0]);
    
    // Inserir usuário Ricardo (Web Designer)
    const ricardoResult = await pool.query(`
      INSERT INTO users (
        email,
        password_hash,
        full_name,
        position,
        bio,
        avatar_url,
        is_active,
        can_access_dashboard,
        can_access_briefings,
        can_access_codes,
        can_access_projects,
        can_access_expenses,
        can_access_crm,
        can_access_users,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
      ) RETURNING id, email, full_name, position
    `, [
      'ricardorpc11@gmail.com',
      ricardoPasswordHash,
      'Ricardo',
      'Web Designer',
      null,
      null,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false
    ]);
    
    console.log('✅ Usuário Ricardo criado:', ricardoResult.rows[0]);
    
    // Verificar se os usuários foram criados
    const verifyResult = await pool.query(`
      SELECT id, email, full_name, position, is_active 
      FROM users 
      WHERE email IN ($1, $2)
      ORDER BY email
    `, ['agenciakaizendesign@gmail.com', 'ricardorpc11@gmail.com']);
    
    console.log('\n📋 Usuários criados:');
    verifyResult.rows.forEach(user => {
      console.log(`- ${user.full_name} (${user.email}) - ${user.position} - ${user.is_active ? 'Ativo' : 'Inativo'}`);
    });
    
    console.log('\n🎉 Usuários criados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao criar usuários:', error);
  } finally {
    await pool.end();
    console.log('🔌 Conexão com banco de dados encerrada');
  }
}

// Executar o script
if (require.main === module) {
  createUsers();
}

module.exports = { createUsers };