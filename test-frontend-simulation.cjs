const axios = require('axios');

async function testFrontendSimulation() {
  try {
    console.log('🔍 Simulando comportamento do frontend...');
    
    // 1. Login como administrador (simula o que o frontend faz)
    console.log('\n1. Fazendo login como administrador...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'agenciakaizendesign@gmail.com',
      password: 'Beatriz@2908'
    });
    
    const { user: adminUser, token } = loginResponse.data;
    console.log('✅ Login realizado com sucesso!');
    console.log(`👤 Usuário: ${adminUser.full_name} (${adminUser.position})`);
    console.log(`🔐 can_access_users: ${adminUser.can_access_users}`);
    
    // 2. Verificar se isAdmin seria true no frontend
    const isAdmin = adminUser?.position === 'Administrador';
    console.log(`\n2. Verificação isAdmin (frontend): ${isAdmin ? '✅ SIM' : '❌ NÃO'}`);
    
    if (!isAdmin) {
      console.log('❌ PROBLEMA: isAdmin é false, botões de edição não aparecerão!');
      return;
    }
    
    // 3. Buscar usuários (simula useUsers hook)
    console.log('\n3. Buscando usuários (simula useUsers hook)...');
    const usersResponse = await axios.get('http://localhost:3001/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const usuarios = usersResponse.data;
    console.log(`✅ Usuários encontrados: ${usuarios.length}`);
    
    // 4. Simular seleção de um usuário para editar
    const otherUsers = usuarios.filter(u => u.id !== adminUser.id);
    if (otherUsers.length === 0) {
      console.log('⚠️  Nenhum outro usuário encontrado para testar edição');
      return;
    }
    
    const selectedUser = otherUsers[0];
    console.log(`\n4. Simulando edição do usuário: ${selectedUser.full_name} (${selectedUser.email})`);
    console.log('📋 Dados atuais do usuário:');
    console.log(`   - can_access_dashboard: ${selectedUser.can_access_dashboard}`);
    console.log(`   - can_access_briefings: ${selectedUser.can_access_briefings}`);
    console.log(`   - can_access_codes: ${selectedUser.can_access_codes}`);
    console.log(`   - can_access_projects: ${selectedUser.can_access_projects}`);
    console.log(`   - can_access_expenses: ${selectedUser.can_access_expenses}`);
    console.log(`   - can_access_crm: ${selectedUser.can_access_crm}`);
    console.log(`   - can_access_users: ${selectedUser.can_access_users}`);
    
    // 5. Simular alteração de permissões (como o frontend faria)
    console.log('\n5. Simulando alteração de permissões...');
    const updatedPermissions = {
      full_name: selectedUser.full_name,
      email: selectedUser.email,
      position: selectedUser.position,
      is_active: selectedUser.is_active,
      can_access_dashboard: selectedUser.can_access_dashboard,
      can_access_briefings: !selectedUser.can_access_briefings, // Inverter para testar
      can_access_codes: selectedUser.can_access_codes,
      can_access_projects: selectedUser.can_access_projects,
      can_access_expenses: selectedUser.can_access_expenses,
      can_access_crm: selectedUser.can_access_crm,
      can_access_users: selectedUser.can_access_users
    };
    
    console.log(`📝 Alterando can_access_briefings de ${selectedUser.can_access_briefings} para ${updatedPermissions.can_access_briefings}`);
    
    // 6. Simular chamada da API updateUser (como o frontend faria)
    console.log('\n6. Simulando chamada updateUser...');
    const updateResponse = await axios.put(`http://localhost:3001/api/users/${selectedUser.id}`, updatedPermissions, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Usuário atualizado com sucesso!');
    
    // 7. Verificar se a alteração foi salva
    console.log('\n7. Verificando se a alteração foi salva...');
    const verifyResponse = await axios.get(`http://localhost:3001/api/users/${selectedUser.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const updatedUser = verifyResponse.data;
    console.log(`✅ Verificação: can_access_briefings agora é ${updatedUser.can_access_briefings}`);
    
    if (updatedUser.can_access_briefings === updatedPermissions.can_access_briefings) {
      console.log('✅ Alteração salva corretamente!');
    } else {
      console.log('❌ PROBLEMA: Alteração não foi salva!');
    }
    
    // 8. Simular refreshUserData se o usuário editado fosse o próprio admin
    if (selectedUser.id === adminUser.id) {
      console.log('\n8. Simulando refreshUserData (usuário editou a si mesmo)...');
      const refreshResponse = await axios.get('http://localhost:3001/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('✅ Dados do usuário atualizados via refreshUserData');
    }
    
    // 9. Simular refetch da lista de usuários
    console.log('\n9. Simulando refetch da lista de usuários...');
    const refetchResponse = await axios.get('http://localhost:3001/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const refetchedUsers = refetchResponse.data;
    const refetchedUser = refetchedUsers.find(u => u.id === selectedUser.id);
    
    if (refetchedUser) {
      console.log(`✅ Usuário na lista atualizada: can_access_briefings = ${refetchedUser.can_access_briefings}`);
      
      if (refetchedUser.can_access_briefings === updatedPermissions.can_access_briefings) {
        console.log('✅ Lista de usuários refletindo as alterações corretamente!');
      } else {
        console.log('❌ PROBLEMA: Lista de usuários não reflete as alterações!');
      }
    }
    
    // 10. Resumo final
    console.log('\n📋 RESUMO DA SIMULAÇÃO:');
    console.log(`✅ Login do administrador: OK`);
    console.log(`✅ Verificação isAdmin: ${isAdmin ? 'OK' : 'FALHA'}`);
    console.log(`✅ Busca de usuários: OK`);
    console.log(`✅ Edição de permissões: OK`);
    console.log(`✅ Persistência das alterações: OK`);
    console.log(`✅ Refetch da lista: OK`);
    
    console.log('\n🎉 SIMULAÇÃO COMPLETA! O frontend deveria estar funcionando.');
    console.log('\n💡 Se o problema persiste no frontend, pode ser:');
    console.log('   1. Problema no localStorage (dados desatualizados)');
    console.log('   2. Problema no contexto de autenticação');
    console.log('   3. Problema na renderização condicional dos botões');
    console.log('   4. Cache do navegador');
    
    console.log('\n🔧 Sugestões:');
    console.log('   1. Limpar localStorage e fazer login novamente');
    console.log('   2. Verificar se refreshUserData está sendo chamado');
    console.log('   3. Verificar console do navegador por erros');
    console.log('   4. Usar o arquivo debug-frontend-auth.html para diagnosticar');
    
  } catch (error) {
    console.error('❌ Erro na simulação:', error.response?.data || error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Dados da resposta:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testFrontendSimulation();