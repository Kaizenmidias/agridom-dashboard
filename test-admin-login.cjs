const axios = require('axios');

async function testAdminLogin() {
  try {
    console.log('🔍 Testando login do usuário administrador...');
    
    // Fazer login com o usuário administrador
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'agenciakaizendesign@gmail.com',
      password: 'Beatriz@2908'
    });
    
    console.log('✅ Login realizado com sucesso!');
    console.log('📋 Dados do usuário retornados:');
    console.log(JSON.stringify(loginResponse.data.user, null, 2));
    
    // Verificar se as permissões estão presentes
    const user = loginResponse.data.user;
    const permissions = [
      'can_access_dashboard',
      'can_access_projects', 
      'can_access_briefings',
      'can_access_codes',
      'can_access_expenses',
      'can_access_crm',
      'can_access_users'
    ];
    
    console.log('\n🔐 Verificando permissões:');
    permissions.forEach(permission => {
      const hasPermission = user[permission];
      console.log(`${permission}: ${hasPermission ? '✅ SIM' : '❌ NÃO'}`);
    });
    
    // Testar verificação de token
    console.log('\n🔍 Testando verificação de token...');
    const token = loginResponse.data.token;
    
    const verifyResponse = await axios.get('http://localhost:3001/api/auth/verify', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Token verificado com sucesso!');
    console.log('📋 Dados do usuário na verificação:');
    console.log(JSON.stringify(verifyResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
  }
}

testAdminLogin();