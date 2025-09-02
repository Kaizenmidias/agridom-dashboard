const axios = require('axios');

// Configuração da API
const API_BASE_URL = 'http://localhost:3001/api';

async function testRealtimePermissions() {
  console.log('🔄 Testando atualização de permissões em tempo real...');
  
  try {
    // 1. Fazer login como administrador
    console.log('\n1. Fazendo login como administrador...');
     const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
         email: 'agenciakaizendesign@gmail.com',
         password: 'Beatriz@2908'
       });    
    const { token, user: admin } = loginResponse.data;
    console.log(`✅ Login realizado com sucesso! Admin: ${admin.full_name}`);
    
    // 2. Buscar usuário Ricardo
    console.log('\n2. Buscando usuário Ricardo...');
    const usersResponse = await axios.get(`${API_BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const ricardo = usersResponse.data.find(u => u.email === 'ricardorpc11@gmail.com');
    if (!ricardo) {
      console.log('❌ Usuário Ricardo não encontrado!');
      return;
    }
    
    console.log(`✅ Usuário Ricardo encontrado! ID: ${ricardo.id}`);
    console.log('📋 Permissões atuais do Ricardo:');
    console.log(`   Dashboard: ${ricardo.can_access_dashboard ? '✅' : '❌'}`);
    console.log(`   Projetos: ${ricardo.can_access_projects ? '✅' : '❌'}`);
    console.log(`   Briefings: ${ricardo.can_access_briefings ? '✅' : '❌'}`);
    console.log(`   Códigos: ${ricardo.can_access_codes ? '✅' : '❌'}`);
    console.log(`   Despesas: ${ricardo.can_access_expenses ? '✅' : '❌'}`);
    console.log(`   CRM: ${ricardo.can_access_crm ? '✅' : '❌'}`);
    console.log(`   Usuários: ${ricardo.can_access_users ? '✅' : '❌'}`);
    
    // 3. Alterar permissões do Ricardo (remover acesso aos Briefings)
    console.log('\n3. Alterando permissões do Ricardo (removendo acesso aos Briefings)...');
    const updateData = {
      full_name: ricardo.full_name,
      email: ricardo.email,
      position: ricardo.position,
      is_active: ricardo.is_active,
      can_access_dashboard: false,
      can_access_projects: false,
      can_access_briefings: false, // Removendo acesso
      can_access_codes: true,
      can_access_expenses: false,
      can_access_crm: false,
      can_access_users: false
    };
    
    await axios.put(`${API_BASE_URL}/users/${ricardo.id}`, updateData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Permissões do Ricardo atualizadas com sucesso!');
    
    // 4. Verificar se as alterações foram salvas no banco
    console.log('\n4. Verificando se as alterações foram salvas no banco...');
    const verifyResponse = await axios.get(`${API_BASE_URL}/users/${ricardo.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const updatedRicardo = verifyResponse.data;
    console.log('📋 Novas permissões do Ricardo:');
    console.log(`   Dashboard: ${updatedRicardo.can_access_dashboard ? '✅' : '❌'}`);
    console.log(`   Projetos: ${updatedRicardo.can_access_projects ? '✅' : '❌'}`);
    console.log(`   Briefings: ${updatedRicardo.can_access_briefings ? '✅' : '❌'}`);
    console.log(`   Códigos: ${updatedRicardo.can_access_codes ? '✅' : '❌'}`);
    console.log(`   Despesas: ${updatedRicardo.can_access_expenses ? '✅' : '❌'}`);
    console.log(`   CRM: ${updatedRicardo.can_access_crm ? '✅' : '❌'}`);
    console.log(`   Usuários: ${updatedRicardo.can_access_users ? '✅' : '❌'}`);
    
    // 5. Simular verificação de token do Ricardo (como se ele estivesse logado)
    console.log('\n5. Simulando verificação de token do Ricardo...');
    
    // Primeiro, fazer login como Ricardo para obter seu token
     const ricardoLoginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
       email: 'ricardorpc11@gmail.com',
       password: 'ricardo123'
     });
    
    const ricardoToken = ricardoLoginResponse.data.token;
    console.log('✅ Token do Ricardo obtido!');
    
    // Verificar o token do Ricardo (isso simula o que o frontend faria)
    const ricardoVerifyResponse = await axios.get(`${API_BASE_URL}/auth/verify`, {
      headers: { 'Authorization': `Bearer ${ricardoToken}` }
    });
    
    const ricardoFromToken = ricardoVerifyResponse.data;
    console.log('📋 Permissões do Ricardo via token:');
    console.log(`   Dashboard: ${ricardoFromToken.can_access_dashboard ? '✅' : '❌'}`);
    console.log(`   Projetos: ${ricardoFromToken.can_access_projects ? '✅' : '❌'}`);
    console.log(`   Briefings: ${ricardoFromToken.can_access_briefings ? '✅' : '❌'}`);
    console.log(`   Códigos: ${ricardoFromToken.can_access_codes ? '✅' : '❌'}`);
    console.log(`   Despesas: ${ricardoFromToken.can_access_expenses ? '✅' : '❌'}`);
    console.log(`   CRM: ${ricardoFromToken.can_access_crm ? '✅' : '❌'}`);
    console.log(`   Usuários: ${ricardoFromToken.can_access_users ? '✅' : '❌'}`);
    
    // 6. Verificar se as permissões estão corretas
    console.log('\n6. Verificando se as permissões estão corretas...');
    
    const expectedPermissions = {
      can_access_dashboard: false,
      can_access_projects: false,
      can_access_briefings: false,
      can_access_codes: true,
      can_access_expenses: false,
      can_access_crm: false,
      can_access_users: false
    };
    
    let allCorrect = true;
    for (const [permission, expected] of Object.entries(expectedPermissions)) {
      const actual = ricardoFromToken[permission];
      const isCorrect = (actual === expected) || (actual === 1 && expected === true) || (actual === 0 && expected === false);
      
      if (!isCorrect) {
        console.log(`❌ ${permission}: esperado ${expected}, obtido ${actual}`);
        allCorrect = false;
      } else {
        console.log(`✅ ${permission}: ${actual} (correto)`);
      }
    }
    
    if (allCorrect) {
      console.log('\n🎉 SUCESSO! Todas as permissões estão corretas!');
      console.log('✅ O sistema de atualização em tempo real está funcionando!');
    } else {
      console.log('\n❌ ERRO! Algumas permissões não estão corretas.');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.response?.data || error.message);
  }
}

// Executar o teste
testRealtimePermissions();