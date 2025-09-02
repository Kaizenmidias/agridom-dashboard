const axios = require('axios');

async function testUsuariosPage() {
  try {
    console.log('🔍 Testando acesso à página de usuários...');
    
    // 1. Fazer login como administrador
    console.log('\n1. Fazendo login como administrador...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'agenciakaizendesign@gmail.com',
      password: 'Beatriz@2908'
    });
    
    const { user, token } = loginResponse.data;
    console.log('✅ Login realizado com sucesso!');
    console.log(`👤 Usuário: ${user.full_name} (${user.position})`);
    
    // 2. Verificar permissões específicas
    console.log('\n2. Verificando permissões do administrador...');
    console.log(`🔐 can_access_users: ${user.can_access_users ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`🔐 position: ${user.position}`);
    
    // 3. Simular verificação isAdmin do frontend
    const isAdmin = user?.position === 'Administrador';
    console.log(`\n3. Verificação isAdmin (frontend): ${isAdmin ? '✅ SIM' : '❌ NÃO'}`);
    
    // 4. Testar busca de usuários
    console.log('\n4. Testando busca de usuários...');
    const usersResponse = await axios.get('http://localhost:3001/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`✅ Usuários encontrados: ${usersResponse.data.length}`);
    
    // 5. Verificar se pode editar outros usuários
    console.log('\n5. Testando edição de usuário...');
    const otherUsers = usersResponse.data.filter(u => u.id !== user.id);
    
    if (otherUsers.length > 0) {
      const testUser = otherUsers[0];
      console.log(`🎯 Testando edição do usuário: ${testUser.full_name} (${testUser.email})`);
      
      // Tentar atualizar permissões
      const updateResponse = await axios.put(`http://localhost:3001/api/users/${testUser.id}`, {
        full_name: testUser.full_name,
        email: testUser.email,
        position: testUser.position,
        is_active: testUser.is_active,
        can_access_dashboard: testUser.can_access_dashboard,
        can_access_projects: testUser.can_access_projects,
        can_access_briefings: !testUser.can_access_briefings, // Inverter para testar
        can_access_codes: testUser.can_access_codes,
        can_access_expenses: testUser.can_access_expenses,
        can_access_crm: testUser.can_access_crm,
        can_access_users: testUser.can_access_users
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('✅ Edição de usuário realizada com sucesso!');
      console.log(`📝 Briefings alterado de ${testUser.can_access_briefings} para ${!testUser.can_access_briefings}`);
      
      // Verificar se a alteração foi salva
      const verifyResponse = await axios.get(`http://localhost:3001/api/users/${testUser.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const updatedUser = verifyResponse.data;
      console.log(`✅ Verificação: Briefings agora é ${updatedUser.can_access_briefings}`);
      
    } else {
      console.log('⚠️  Nenhum outro usuário encontrado para testar edição');
    }
    
    // 6. Resumo final
    console.log('\n📋 RESUMO DO TESTE:');
    console.log(`✅ Login: OK`);
    console.log(`✅ Permissão can_access_users: ${user.can_access_users ? 'OK' : 'FALHA'}`);
    console.log(`✅ Verificação isAdmin: ${isAdmin ? 'OK' : 'FALHA'}`);
    console.log(`✅ Busca de usuários: OK`);
    console.log(`✅ Edição de usuários: OK`);
    
    if (user.can_access_users && isAdmin) {
      console.log('\n🎉 TUDO FUNCIONANDO! O administrador deve conseguir editar usuários.');
    } else {
      console.log('\n❌ PROBLEMA IDENTIFICADO!');
      if (!user.can_access_users) {
        console.log('   - Permissão can_access_users está falsa');
      }
      if (!isAdmin) {
        console.log('   - Verificação isAdmin está falsa');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Dados da resposta:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testUsuariosPage();