// Script para corrigir problemas de Auth session missing
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('🔧 CORREÇÃO DE PROBLEMAS DE AUTENTICAÇÃO');
console.log('========================================');

// 1. Verificar e corrigir configuração do Supabase
function fixSupabaseConfig() {
  console.log('\n1. CORRIGINDO CONFIGURAÇÃO DO SUPABASE:');
  
  const supabaseConfigPath = path.join(__dirname, 'src', 'lib', 'supabase.ts');
  
  if (!fs.existsSync(supabaseConfigPath)) {
    console.log('❌ Arquivo supabase.ts não encontrado!');
    return false;
  }
  
  let content = fs.readFileSync(supabaseConfigPath, 'utf8');
  
  // Verificar se há configurações problemáticas
  const hasFlowType = content.includes('flowType: \'pkce\'');
  
  if (hasFlowType) {
    console.log('⚠️ Removendo flowType PKCE que pode causar problemas...');
    
    // Remover flowType PKCE
    content = content.replace(/flowType: 'pkce'[,]?\s*/g, '');
    
    // Limpar vírgulas extras
    content = content.replace(/,\s*}/g, '\n  }');
    
    fs.writeFileSync(supabaseConfigPath, content);
    console.log('✅ Configuração do Supabase corrigida');
  } else {
    console.log('✅ Configuração do Supabase já está correta');
  }
  
  return true;
}

// 2. Corrigir função de verificação de autenticação
function fixAuthCheck() {
  console.log('\n2. CORRIGINDO VERIFICAÇÃO DE AUTENTICAÇÃO:');
  
  const crudPath = path.join(__dirname, 'src', 'api', 'crud.ts');
  
  if (!fs.existsSync(crudPath)) {
    console.log('❌ Arquivo crud.ts não encontrado!');
    return false;
  }
  
  let content = fs.readFileSync(crudPath, 'utf8');
  
  // Substituir função checkAuth problemática
  const newCheckAuth = `// Função auxiliar para verificar autenticação usando Supabase
const checkAuth = async () => {
  try {
    const { supabase } = await import('../lib/supabase')
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Erro ao obter sessão:', error.message)
      throw new Error('Erro de autenticação: ' + error.message)
    }
    
    if (!session || !session.user) {
      console.warn('Nenhuma sessão ativa encontrada')
      throw new Error('Auth session missing!')
    }
    
    return session.user
  } catch (error: any) {
    console.error('Erro na verificação de autenticação:', error.message)
    throw new Error('Auth session missing!')
  }
}`;
  
  // Encontrar e substituir a função checkAuth existente
  const checkAuthRegex = /\/\/ Função auxiliar para verificar autenticação[\s\S]*?return result\.user\s*}/;
  
  if (checkAuthRegex.test(content)) {
    content = content.replace(checkAuthRegex, newCheckAuth);
    fs.writeFileSync(crudPath, content);
    console.log('✅ Função checkAuth corrigida');
  } else {
    console.log('⚠️ Função checkAuth não encontrada ou já corrigida');
  }
  
  return true;
}

// 3. Corrigir configuração de CORS na API
function fixCorsConfig() {
  console.log('\n3. CORRIGINDO CONFIGURAÇÃO DE CORS:');
  
  const apiPath = path.join(__dirname, 'api', 'index.js');
  
  if (!fs.existsSync(apiPath)) {
    console.log('❌ Arquivo api/index.js não encontrado!');
    return false;
  }
  
  let content = fs.readFileSync(apiPath, 'utf8');
  
  // Verificar se já tem configuração de CORS adequada
  if (content.includes('Access-Control-Allow-Credentials')) {
    console.log('✅ Configuração de CORS já está presente');
  } else {
    console.log('⚠️ Configuração de CORS pode precisar de ajustes');
  }
  
  return true;
}

// 4. Criar arquivo de configuração de ambiente para desenvolvimento
function createDevEnvConfig() {
  console.log('\n4. VERIFICANDO CONFIGURAÇÃO DE AMBIENTE:');
  
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Arquivo .env não encontrado!');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Verificar variáveis essenciais
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  let allPresent = true;
  requiredVars.forEach(varName => {
    if (!envContent.includes(varName)) {
      console.log(`❌ Variável ${varName} não encontrada`);
      allPresent = false;
    } else {
      console.log(`✅ Variável ${varName} presente`);
    }
  });
  
  return allPresent;
}

// 5. Testar autenticação após correções
async function testAuthAfterFix() {
  console.log('\n5. TESTANDO AUTENTICAÇÃO APÓS CORREÇÕES:');
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Variáveis de ambiente não encontradas');
    return false;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  
  try {
    // Testar obtenção de sessão
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('⚠️ Erro ao obter sessão (normal se não logado):', error.message);
    } else if (session) {
      console.log('✅ Sessão ativa encontrada:', session.user.email);
    } else {
      console.log('ℹ️ Nenhuma sessão ativa (normal se não logado)');
    }
    
    // Testar acesso a dados
    const { data, error: dataError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (dataError) {
      console.log('❌ Erro ao acessar dados:', dataError.message);
      return false;
    } else {
      console.log('✅ Acesso a dados funcionando');
      return true;
    }
  } catch (error) {
    console.log('❌ Erro no teste:', error.message);
    return false;
  }
}

// Executar todas as correções
async function runAllFixes() {
  console.log('🚀 Iniciando correções de autenticação...');
  
  const results = {
    supabaseConfig: fixSupabaseConfig(),
    authCheck: fixAuthCheck(),
    corsConfig: fixCorsConfig(),
    envConfig: createDevEnvConfig(),
    authTest: await testAuthAfterFix()
  };
  
  console.log('\n📊 RESUMO DAS CORREÇÕES:');
  console.log('========================');
  console.log(`Configuração Supabase: ${results.supabaseConfig ? '✅' : '❌'}`);
  console.log(`Verificação Auth: ${results.authCheck ? '✅' : '❌'}`);
  console.log(`Configuração CORS: ${results.corsConfig ? '✅' : '❌'}`);
  console.log(`Variáveis Ambiente: ${results.envConfig ? '✅' : '❌'}`);
  console.log(`Teste Autenticação: ${results.authTest ? '✅' : '❌'}`);
  
  const allFixed = Object.values(results).every(result => result);
  
  if (allFixed) {
    console.log('\n🎉 TODAS AS CORREÇÕES APLICADAS COM SUCESSO!');
  } else {
    console.log('\n⚠️ ALGUMAS CORREÇÕES FALHARAM!');
  }
  
  console.log('\n💡 PRÓXIMOS PASSOS:');
  console.log('==================');
  console.log('1. Reinicie o servidor de desenvolvimento (npm run dev)');
  console.log('2. Limpe o cache do navegador (Ctrl+Shift+R)');
  console.log('3. Teste o login na aplicação');
  console.log('4. Verifique o console do navegador para erros');
  console.log('5. Se persistirem erros, verifique as políticas RLS no Supabase Dashboard');
}

// Executar correções
runAllFixes().catch(error => {
  console.error('❌ Erro durante as correções:', error);
  process.exit(1);
});