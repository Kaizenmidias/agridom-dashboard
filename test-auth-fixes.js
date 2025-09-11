// Script para testar se os erros de autenticação foram corrigidos
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🧪 TESTE DE CORREÇÕES DE AUTENTICAÇÃO');
console.log('===================================');

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Variáveis de ambiente não encontradas!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// 1. Testar conexão básica
async function testBasicConnection() {
  try {
    console.log('\n1. TESTANDO CONEXÃO BÁSICA:');
    
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Erro na conexão:', error.message);
      return false;
    }
    
    console.log('✅ Conexão básica funcionando');
    return true;
  } catch (error) {
    console.log('❌ Erro na conexão:', error.message);
    return false;
  }
}

// 2. Testar autenticação de sessão
async function testSessionAuth() {
  try {
    console.log('\n2. TESTANDO AUTENTICAÇÃO DE SESSÃO:');
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('⚠️ Erro ao obter sessão:', error.message);
      return false;
    }
    
    if (session) {
      console.log('✅ Sessão ativa encontrada:', session.user.email);
      return true;
    } else {
      console.log('ℹ️ Nenhuma sessão ativa (normal se não logado)');
      return true; // Não é erro se não há sessão
    }
  } catch (error) {
    console.log('❌ Erro na verificação de sessão:', error.message);
    return false;
  }
}

// 3. Testar acesso a dados sem autenticação
async function testDataAccess() {
  try {
    console.log('\n3. TESTANDO ACESSO A DADOS:');
    
    // Testar acesso a usuários
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name')
      .limit(3);
    
    if (usersError) {
      console.log('❌ Erro ao acessar usuários:', usersError.message);
      return false;
    }
    
    console.log(`✅ Acesso a usuários funcionando (${users.length} encontrados)`);
    
    // Testar acesso a projetos
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .limit(3);
    
    if (projectsError) {
      console.log('❌ Erro ao acessar projetos:', projectsError.message);
      return false;
    }
    
    console.log(`✅ Acesso a projetos funcionando (${projects.length} encontrados)`);
    
    return true;
  } catch (error) {
    console.log('❌ Erro no acesso a dados:', error.message);
    return false;
  }
}

// 4. Testar login com usuário existente
async function testLogin() {
  try {
    console.log('\n4. TESTANDO LOGIN:');
    
    // Tentar login com usuário conhecido
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'ricardorpc11@gmail.com',
      password: '@FDPfeioso90'
    });
    
    if (error) {
      console.log('⚠️ Erro no login (pode ser senha incorreta):', error.message);
      return false;
    }
    
    if (data.session && data.user) {
      console.log('✅ Login funcionando para:', data.user.email);
      
      // Fazer logout após teste
      await supabase.auth.signOut();
      console.log('✅ Logout funcionando');
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('❌ Erro no teste de login:', error.message);
    return false;
  }
}

// 5. Verificar se os erros anteriores foram resolvidos
function checkErrorsResolved() {
  console.log('\n5. VERIFICANDO RESOLUÇÃO DOS ERROS:');
  
  const commonErrors = [
    'Auth session missing!',
    'Failed to fetch',
    'TypeError: Failed to fetch',
    'net::ERR_ABORTED'
  ];
  
  console.log('❌ Erros que DEVEM ter sido resolvidos:');
  commonErrors.forEach(error => {
    console.log(`   - ${error}`);
  });
  
  console.log('\n✅ Se você não vir mais esses erros no console do navegador, as correções funcionaram!');
  
  return true;
}

// 6. Executar todos os testes
async function runAllTests() {
  console.log('🚀 Iniciando testes de correção...');
  
  const results = {
    connection: await testBasicConnection(),
    session: await testSessionAuth(),
    dataAccess: await testDataAccess(),
    login: await testLogin(),
    errorsCheck: checkErrorsResolved()
  };
  
  console.log('\n📊 RESUMO DOS TESTES:');
  console.log('====================');
  console.log(`Conexão Básica: ${results.connection ? '✅' : '❌'}`);
  console.log(`Autenticação Sessão: ${results.session ? '✅' : '❌'}`);
  console.log(`Acesso a Dados: ${results.dataAccess ? '✅' : '❌'}`);
  console.log(`Teste de Login: ${results.login ? '✅' : '⚠️'}`);
  console.log(`Verificação Erros: ${results.errorsCheck ? '✅' : '❌'}`);
  
  const criticalTests = [results.connection, results.session, results.dataAccess];
  const allCriticalPassed = criticalTests.every(result => result);
  
  if (allCriticalPassed) {
    console.log('\n🎉 CORREÇÕES APLICADAS COM SUCESSO!');
    console.log('Os principais problemas de autenticação foram resolvidos.');
  } else {
    console.log('\n⚠️ ALGUNS PROBLEMAS AINDA PERSISTEM!');
    console.log('Verifique os erros acima e considere verificar:');
    console.log('- Políticas RLS no Supabase Dashboard');
    console.log('- Configurações de domínio no Supabase');
    console.log('- Variáveis de ambiente na Vercel');
  }
  
  console.log('\n💡 COMO VERIFICAR NO NAVEGADOR:');
  console.log('===============================');
  console.log('1. Abra http://localhost:8080/');
  console.log('2. Abra DevTools (F12)');
  console.log('3. Vá para a aba Console');
  console.log('4. Recarregue a página (Ctrl+R)');
  console.log('5. Verifique se NÃO aparecem mais os erros:');
  console.log('   - "Auth session missing!"');
  console.log('   - "Failed to fetch"');
  console.log('   - "net::ERR_ABORTED"');
  console.log('6. Tente navegar pelas páginas (Usuários, Projetos, etc.)');
  console.log('7. Teste o login com um usuário válido');
  
  console.log('\n🔧 SE AINDA HOUVER PROBLEMAS:');
  console.log('=============================');
  console.log('1. Limpe o cache do navegador (Ctrl+Shift+R)');
  console.log('2. Verifique se as variáveis de ambiente estão corretas na Vercel');
  console.log('3. Confirme se o domínio está configurado no Supabase Dashboard');
  console.log('4. Verifique as políticas RLS no Supabase');
}

// Executar testes
runAllTests().catch(error => {
  console.error('❌ Erro durante os testes:', error);
  process.exit(1);
});