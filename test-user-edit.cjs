const axios = require('axios');

async function testUserEdit() {
  try {
    console.log('=== TESTE DE EDIÇÃO DE USUÁRIO ===\n');
    
    // 1. Fazer login como administrador
    console.log('1. Fazendo login como administrador...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'agenciakaizendesign@gmail.com',
      password: 'Beatriz@2908'
    });
    
    if (!loginResponse.data.user || !loginResponse.data.token) {
      console.log('❌ Falha no login');
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso');
    
    // 2. Buscar todos os usuários
    console.log('\n2. Buscando lista de usuários...');
    const usersResponse = await axios.get('http://localhost:3001/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const users = usersResponse.data;
    console.log(`✅ Encontrados ${users.length} usuários`);
    
    // 3. Encontrar um usuário que não seja o administrador para testar
    const testUser = users.find(user => user.email !== 'agenciakaizendesign@gmail.com');
    
    if (!testUser) {
      console.log('❌ Nenhum usuário encontrado para teste (além do administrador)');
      return;
    }
    
    console.log(`\n3. Usuário selecionado para teste:`);
    console.log(`   ID: ${testUser.id}`);
    console.log(`   Nome: ${testUser.full_name}`);
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Cargo: ${testUser.position}`);
    console.log(`   Status: ${testUser.is_active ? 'Ativo' : 'Inativo'}`);
    console.log(`   Permissões atuais:`);
    console.log(`     - Dashboard: ${testUser.can_access_dashboard}`);
    console.log(`     - Projetos: ${testUser.can_access_projects}`);
    console.log(`     - Briefings: ${testUser.can_access_briefings}`);
    console.log(`     - Códigos: ${testUser.can_access_codes}`);
    console.log(`     - Despesas: ${testUser.can_access_expenses}`);
    console.log(`     - CRM: ${testUser.can_access_crm}`);
    console.log(`     - Usuários: ${testUser.can_access_users}`);
    
    // 4. Testar atualização de permissões
    console.log('\n4. Testando atualização de permissões...');
    
    const updateData = {
      full_name: testUser.full_name,
      email: testUser.email,
      position: testUser.position,
      is_active: testUser.is_active,
      can_access_dashboard: true,
      can_access_projects: true,
      can_access_briefings: false,
      can_access_codes: false,
      can_access_expenses: true,
      can_access_crm: false,
      can_access_users: false
    };
    
    console.log('Dados que serão enviados:', JSON.stringify(updateData, null, 2));
    
    const updateResponse = await axios.put(`http://localhost:3001/api/users/${testUser.id}`, updateData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Usuário atualizado com sucesso!');
    console.log('Dados retornados:', JSON.stringify(updateResponse.data, null, 2));
    
    // 5. Verificar se as alterações foram salvas
    console.log('\n5. Verificando se as alterações foram salvas...');
    const verifyResponse = await axios.get(`http://localhost:3001/api/users/${testUser.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const updatedUser = verifyResponse.data;
    console.log('Permissões após atualização:');
    console.log(`  - Dashboard: ${updatedUser.can_access_dashboard}`);
    console.log(`  - Projetos: ${updatedUser.can_access_projects}`);
    console.log(`  - Briefings: ${updatedUser.can_access_briefings}`);
    console.log(`  - Códigos: ${updatedUser.can_access_codes}`);
    console.log(`  - Despesas: ${updatedUser.can_access_expenses}`);
    console.log(`  - CRM: ${updatedUser.can_access_crm}`);
    console.log(`  - Usuários: ${updatedUser.can_access_users}`);
    
    // 6. Verificar se as permissões foram aplicadas corretamente
    const expectedPermissions = {
      can_access_dashboard: true,
      can_access_projects: true,
      can_access_briefings: false,
      can_access_codes: false,
      can_access_expenses: true,
      can_access_crm: false,
      can_access_users: false
    };
    
    let allCorrect = true;
    for (const [permission, expected] of Object.entries(expectedPermissions)) {
      const actual = updatedUser[permission];
      const isCorrect = (actual === expected) || (actual === 1 && expected === true) || (actual === 0 && expected === false);
      
      if (!isCorrect) {
        console.log(`❌ ${permission}: esperado ${expected}, obtido ${actual}`);
        allCorrect = false;
      } else {
        console.log(`✅ ${permission}: correto (${actual})`);
      }
    }
    
    if (allCorrect) {
      console.log('\n🎉 Todas as permissões foram atualizadas corretamente!');
    } else {
      console.log('\n⚠️  Algumas permissões não foram atualizadas corretamente.');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Dados da resposta:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testUserEdit();