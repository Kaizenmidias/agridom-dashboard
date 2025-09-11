// Script para verificar e corrigir políticas RLS do Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔒 VERIFICAÇÃO DE POLÍTICAS RLS - SUPABASE');
console.log('==========================================');

// Usar service role key para verificar políticas
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.log('❌ Variáveis de ambiente do Supabase não encontradas!');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Verificar políticas RLS existentes
async function checkRLSPolicies() {
  try {
    console.log('\n1. VERIFICANDO POLÍTICAS RLS EXISTENTES:');
    
    // Query para verificar políticas RLS
    const { data: policies, error } = await supabaseAdmin
      .from('pg_policies')
      .select('*')
      .in('tablename', ['users', 'projects', 'expenses', 'codes', 'briefings']);
    
    if (error) {
      console.log('❌ Erro ao verificar políticas:', error.message);
      return false;
    }
    
    console.log(`✅ Encontradas ${policies.length} políticas RLS`);
    
    // Agrupar por tabela
    const policiesByTable = {};
    policies.forEach(policy => {
      if (!policiesByTable[policy.tablename]) {
        policiesByTable[policy.tablename] = [];
      }
      policiesByTable[policy.tablename].push(policy);
    });
    
    // Mostrar políticas por tabela
    Object.keys(policiesByTable).forEach(tableName => {
      console.log(`\n📋 Tabela: ${tableName}`);
      policiesByTable[tableName].forEach(policy => {
        console.log(`   - ${policy.policyname} (${policy.cmd})`);
      });
    });
    
    return true;
  } catch (error) {
    console.log('❌ Erro ao verificar políticas RLS:', error.message);
    return false;
  }
}

// Verificar se RLS está habilitado nas tabelas
async function checkRLSEnabled() {
  try {
    console.log('\n2. VERIFICANDO SE RLS ESTÁ HABILITADO:');
    
    const tables = ['users', 'projects', 'expenses', 'codes', 'briefings'];
    
    for (const tableName of tables) {
      const { data, error } = await supabaseAdmin
        .rpc('check_rls_enabled', { table_name: tableName })
        .single();
      
      if (error) {
        // Se a função não existir, tentar método alternativo
        console.log(`⚠️ ${tableName}: Não foi possível verificar RLS`);
        continue;
      }
      
      console.log(`${data ? '🔒' : '🔓'} ${tableName}: RLS ${data ? 'HABILITADO' : 'DESABILITADO'}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Erro ao verificar status RLS:', error.message);
    return false;
  }
}

// Testar acesso às tabelas com usuário anônimo
async function testAnonymousAccess() {
  try {
    console.log('\n3. TESTANDO ACESSO ANÔNIMO:');
    
    // Criar cliente com chave anônima
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    
    const tables = ['users', 'projects', 'expenses'];
    
    for (const tableName of tables) {
      try {
        const { data, error } = await supabaseAnon
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: Acesso permitido (${data.length} registros)`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.log('❌ Erro no teste de acesso anônimo:', error.message);
    return false;
  }
}

// Criar políticas RLS básicas se necessário
async function createBasicRLSPolicies() {
  try {
    console.log('\n4. CRIANDO POLÍTICAS RLS BÁSICAS:');
    
    // Política para permitir leitura de usuários autenticados
    const policies = [
      {
        table: 'users',
        name: 'Users can view all users',
        operation: 'SELECT',
        policy: 'true' // Permitir leitura para todos (pode ser restringido depois)
      },
      {
        table: 'projects',
        name: 'Users can view all projects',
        operation: 'SELECT',
        policy: 'true'
      },
      {
        table: 'expenses',
        name: 'Users can view all expenses',
        operation: 'SELECT',
        policy: 'true'
      }
    ];
    
    for (const policyDef of policies) {
      try {
        // Primeiro, tentar remover política existente
        await supabaseAdmin.rpc('drop_policy_if_exists', {
          table_name: policyDef.table,
          policy_name: policyDef.name
        });
        
        // Criar nova política
        const { error } = await supabaseAdmin.rpc('create_policy', {
          table_name: policyDef.table,
          policy_name: policyDef.name,
          operation: policyDef.operation,
          policy_definition: policyDef.policy
        });
        
        if (error) {
          console.log(`⚠️ ${policyDef.table}: ${error.message}`);
        } else {
          console.log(`✅ ${policyDef.table}: Política criada`);
        }
      } catch (err) {
        console.log(`⚠️ ${policyDef.table}: ${err.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.log('❌ Erro ao criar políticas RLS:', error.message);
    return false;
  }
}

// Executar todas as verificações
async function runRLSCheck() {
  console.log('🔍 Iniciando verificação de políticas RLS...');
  
  await checkRLSPolicies();
  await checkRLSEnabled();
  await testAnonymousAccess();
  
  console.log('\n💡 RECOMENDAÇÕES:');
  console.log('================');
  console.log('1. Se houver erros de "Auth session missing", as políticas RLS podem estar muito restritivas');
  console.log('2. Para desenvolvimento, considere desabilitar RLS temporariamente');
  console.log('3. Para produção, configure políticas específicas por usuário/role');
  console.log('4. Verifique se o frontend está enviando tokens de autenticação corretamente');
  
  console.log('\n🔧 COMANDOS SQL ÚTEIS:');
  console.log('======================');
  console.log('-- Desabilitar RLS (temporário):');
  console.log('ALTER TABLE users DISABLE ROW LEVEL SECURITY;');
  console.log('ALTER TABLE projects DISABLE ROW LEVEL SECURITY;');
  console.log('ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;');
  console.log('');
  console.log('-- Habilitar RLS:');
  console.log('ALTER TABLE users ENABLE ROW LEVEL SECURITY;');
  console.log('ALTER TABLE projects ENABLE ROW LEVEL SECURITY;');
  console.log('ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;');
}

// Executar verificação
runRLSCheck().catch(error => {
  console.error('❌ Erro durante a verificação RLS:', error);
  process.exit(1);
});