const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

// Configuração do Supabase para produção
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.log('Certifique-se de que VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas em .env.production');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCurrentSchema() {
  console.log('🔍 Verificando schema atual...');
  
  try {
    // Verificar estrutura da tabela projects
    const { data: projectsSchema, error: projectsError } = await supabase
      .rpc('get_table_schema', { table_name: 'projects' });
    
    if (projectsError) {
      console.log('⚠️  Não foi possível verificar schema via RPC, tentando query direta...');
      
      // Tentar query direta para verificar colunas
      const { data: projects, error: projectsQueryError } = await supabase
        .from('projects')
        .select('*')
        .limit(1);
      
      if (projectsQueryError) {
        console.error('❌ Erro ao acessar tabela projects:', projectsQueryError.message);
      } else {
        console.log('✅ Tabela projects acessível');
        if (projects && projects.length > 0) {
          console.log('📋 Colunas encontradas em projects:', Object.keys(projects[0]));
        }
      }
    }
    
    // Verificar estrutura da tabela expenses
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .limit(1);
    
    if (expensesError) {
      console.error('❌ Erro ao acessar tabela expenses:', expensesError.message);
    } else {
      console.log('✅ Tabela expenses acessível');
      if (expenses && expenses.length > 0) {
        console.log('📋 Colunas encontradas em expenses:', Object.keys(expenses[0]));
        
        // Verificar se tem coluna amount ou value
        const hasAmount = Object.keys(expenses[0]).includes('amount');
        const hasValue = Object.keys(expenses[0]).includes('value');
        
        console.log(`💰 Coluna amount: ${hasAmount ? '✅ Existe' : '❌ Não existe'}`);
        console.log(`💰 Coluna value: ${hasValue ? '✅ Existe' : '❌ Não existe'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar schema:', error.message);
  }
}

async function testProjectCreation() {
  console.log('\n🧪 Testando criação de projeto...');
  
  try {
    // Obter usuário atual para teste
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('⚠️  Usuário não autenticado, usando UUID de teste');
      
      // Tentar criar projeto com UUID de teste
      const testProject = {
        name: 'Projeto Teste Schema',
        description: 'Teste de correção de schema',
        user_id: '00000000-0000-0000-0000-000000000000', // UUID de teste
        status: 'active',
        created_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('projects')
        .insert([testProject])
        .select();
      
      if (error) {
        console.error('❌ Erro ao criar projeto teste:', error.message);
        if (error.message.includes('integer')) {
          console.log('🔧 PROBLEMA CONFIRMADO: user_id ainda é integer, precisa ser UUID');
        }
      } else {
        console.log('✅ Projeto teste criado com sucesso!');
        
        // Limpar projeto teste
        await supabase
          .from('projects')
          .delete()
          .eq('id', data[0].id);
        console.log('🧹 Projeto teste removido');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de projeto:', error.message);
  }
}

async function testExpenseCreation() {
  console.log('\n💸 Testando criação de despesa...');
  
  try {
    const testExpense = {
      description: 'Despesa Teste Schema',
      amount: 100.50,
      value: 100.50, // Incluir ambas as colunas
      category: 'teste',
      date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('expenses')
      .insert([testExpense])
      .select();
    
    if (error) {
      console.error('❌ Erro ao criar despesa teste:', error.message);
      if (error.message.includes('amount')) {
        console.log('🔧 PROBLEMA CONFIRMADO: coluna amount não existe na tabela expenses');
      }
    } else {
      console.log('✅ Despesa teste criada com sucesso!');
      
      // Limpar despesa teste
      await supabase
        .from('expenses')
        .delete()
        .eq('id', data[0].id);
      console.log('🧹 Despesa teste removida');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de despesa:', error.message);
  }
}

async function main() {
  console.log('🚀 Iniciando verificação de schema do Supabase em produção...');
  console.log(`🔗 URL: ${supabaseUrl}`);
  
  await checkCurrentSchema();
  await testProjectCreation();
  await testExpenseCreation();
  
  console.log('\n📋 RESUMO DOS PROBLEMAS ENCONTRADOS:');
  console.log('1. Execute o script fix-production-schema.sql no SQL Editor do Supabase');
  console.log('2. Ou aplique as correções manualmente:');
  console.log('   - ALTER TABLE projects ALTER COLUMN user_id TYPE uuid USING user_id::uuid;');
  console.log('   - ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount numeric;');
  console.log('   - NOTIFY pgrst, \'reload schema\';');
  console.log('\n✅ Após aplicar as correções, execute este script novamente para validar.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkCurrentSchema, testProjectCreation, testExpenseCreation };