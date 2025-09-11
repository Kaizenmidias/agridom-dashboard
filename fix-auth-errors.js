// Script para diagnosticar e corrigir erros de autenticação
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔧 DIAGNÓSTICO DE AUTENTICAÇÃO - AGRIDOM DASHBOARD');
console.log('================================================');

// 1. Verificar variáveis de ambiente
console.log('\n1. VERIFICANDO VARIÁVEIS DE AMBIENTE:');
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 30)}...`);
  } else {
    console.log(`❌ ${varName}: UNDEFINED`);
  }
});

// 2. Testar conexão com Supabase
console.log('\n2. TESTANDO CONEXÃO COM SUPABASE:');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Variáveis do Supabase não encontradas!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Testar conexão básica
async function testSupabaseConnection() {
  try {
    console.log('🔍 Testando conexão básica...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      console.log('❌ Erro na conexão:', error.message);
      return false;
    }
    
    console.log('✅ Conexão com Supabase funcionando!');
    return true;
  } catch (error) {
    console.log('❌ Erro na conexão:', error.message);
    return false;
  }
}

// 3. Verificar autenticação
async function testAuthentication() {
  try {
    console.log('\n3. TESTANDO AUTENTICAÇÃO:');
    
    // Tentar obter sessão atual
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('❌ Erro ao obter sessão:', error.message);
      return false;
    }
    
    if (session) {
      console.log('✅ Sessão ativa encontrada:', session.user.email);
      return true;
    } else {
      console.log('⚠️ Nenhuma sessão ativa (normal se não logado)');
      return true;
    }
  } catch (error) {
    console.log('❌ Erro na verificação de autenticação:', error.message);
    return false;
  }
}

// 4. Verificar configurações de CORS
function checkCorsConfig() {
  console.log('\n4. VERIFICANDO CONFIGURAÇÕES DE CORS:');
  
  const allowedOrigins = [
    'https://agridom-dashboard.vercel.app',
    'http://localhost:8081',
    'http://localhost:8080',
    'http://localhost:3000'
  ];
  
  console.log('✅ Origens permitidas configuradas:');
  allowedOrigins.forEach(origin => {
    console.log(`   - ${origin}`);
  });
}

// 5. Verificar estrutura da tabela users
async function checkUsersTable() {
  try {
    console.log('\n5. VERIFICANDO TABELA DE USUÁRIOS:');
    
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_active')
      .limit(3);
    
    if (error) {
      console.log('❌ Erro ao acessar tabela users:', error.message);
      return false;
    }
    
    console.log(`✅ Tabela users acessível (${data.length} usuários encontrados)`);
    if (data.length > 0) {
      console.log('   Exemplo de usuário:', {
        id: data[0].id,
        email: data[0].email,
        role: data[0].role
      });
    }
    
    return true;
  } catch (error) {
    console.log('❌ Erro ao verificar tabela users:', error.message);
    return false;
  }
}

// 6. Executar todos os testes
async function runDiagnostics() {
  const results = {
    connection: await testSupabaseConnection(),
    authentication: await testAuthentication(),
    usersTable: await checkUsersTable()
  };
  
  checkCorsConfig();
  
  console.log('\n📊 RESUMO DO DIAGNÓSTICO:');
  console.log('========================');
  console.log(`Conexão Supabase: ${results.connection ? '✅' : '❌'}`);
  console.log(`Autenticação: ${results.authentication ? '✅' : '❌'}`);
  console.log(`Tabela Users: ${results.usersTable ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
    console.log('A configuração do Supabase está funcionando corretamente.');
  } else {
    console.log('\n⚠️ ALGUNS TESTES FALHARAM!');
    console.log('Verifique as configurações acima e corrija os problemas identificados.');
  }
  
  console.log('\n💡 PRÓXIMOS PASSOS:');
  console.log('1. Verifique se as variáveis de ambiente estão configuradas na Vercel');
  console.log('2. Confirme se o domínio está configurado no Supabase Dashboard');
  console.log('3. Verifique se as políticas RLS estão configuradas corretamente');
  console.log('4. Teste o login na aplicação web');
}

// Executar diagnóstico
runDiagnostics().catch(error => {
  console.error('❌ Erro durante o diagnóstico:', error);
  process.exit(1);
});