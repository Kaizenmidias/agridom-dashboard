const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Teste da funcionalidade de recuperação de senha
async function testForgotPassword() {
  console.log('🧪 Testando funcionalidade de recuperação de senha...');
  
  const testEmail = 'admin@agridom.com'; // Email que existe no banco
  const apiUrl = 'http://localhost:3001/api/auth/forgot-password';
  
  try {
    console.log(`📧 Enviando solicitação de recuperação para: ${testEmail}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testEmail }),
    });
    
    const data = await response.json();
    
    console.log('📊 Status da resposta:', response.status);
    console.log('📄 Resposta do servidor:', data);
    
    if (response.ok) {
      console.log('✅ Solicitação de recuperação enviada com sucesso!');
      console.log('💡 Verifique o console do servidor para ver o link de preview do email (se usando Ethereal)');
    } else {
      console.log('❌ Erro na solicitação:', data.error);
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar recuperação de senha:', error.message);
    console.log('💡 Verifique se o servidor está rodando na porta 3001');
  }
}

// Teste com email inexistente (deve retornar sucesso por segurança)
async function testForgotPasswordInvalidEmail() {
  console.log('\n🧪 Testando com email inexistente...');
  
  const testEmail = 'email-inexistente@teste.com';
  const apiUrl = 'http://localhost:3001/api/auth/forgot-password';
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testEmail }),
    });
    
    const data = await response.json();
    
    console.log('📊 Status da resposta:', response.status);
    console.log('📄 Resposta do servidor:', data);
    
    if (response.ok) {
      console.log('✅ Resposta correta para email inexistente (não revela se existe)');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar com email inexistente:', error.message);
  }
}

// Executar testes
async function runTests() {
  await testForgotPassword();
  await testForgotPasswordInvalidEmail();
  
  console.log('\n🎯 Testes concluídos!');
  console.log('\n📝 Próximos passos:');
  console.log('1. Acesse http://localhost:5173/login');
  console.log('2. Digite um email e clique em "Esqueci minha senha"');
  console.log('3. Verifique o console do servidor para o link de preview do email');
  console.log('4. Use o link para testar a redefinição de senha');
}

runTests();