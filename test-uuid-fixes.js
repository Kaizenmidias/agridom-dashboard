const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qwbpruywwfjadkudegcj.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YnBydXl3d2ZqYWRrdWRlZ2NqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk2MzI1MCwiZXhwIjoyMDcyNTM5MjUwfQ.5q5dHv8Xn5QMtiTPJEpEIg8gcCM_tKstzCsEuBV2dwM';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testUUIDFixes() {
  console.log('🧪 Testando correções de UUID vs INTEGER...');
  
  try {
    // 1. Testar busca de projetos
    console.log('\n📋 1. Testando busca de projetos...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, status')
      .limit(3);
    
    if (projectsError) {
      console.error('❌ Erro ao buscar projetos:', projectsError.message);
    } else {
      console.log('✅ Projetos encontrados:', projects?.length || 0);
      if (projects && projects.length > 0) {
        console.log('📝 Primeiro projeto ID:', projects[0].id, '(tipo:', typeof projects[0].id, ')');
      }
    }
    
    // 2. Testar busca de despesas
    console.log('\n💰 2. Testando busca de despesas...');
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('id, description, value, project_id')
      .limit(3);
    
    if (expensesError) {
      console.error('❌ Erro ao buscar despesas:', expensesError.message);
    } else {
      console.log('✅ Despesas encontradas:', expenses?.length || 0);
      if (expenses && expenses.length > 0) {
        console.log('📝 Primeira despesa:');
        console.log('   - ID:', expenses[0].id, '(tipo:', typeof expenses[0].id, ')');
        console.log('   - Valor:', expenses[0].value, '(tipo:', typeof expenses[0].value, ')');
        console.log('   - Project ID:', expenses[0].project_id, '(tipo:', typeof expenses[0].project_id, ')');
      }
    }
    
    // 3. Testar criação de despesa (se houver projetos)
    if (projects && projects.length > 0) {
      console.log('\n🆕 3. Testando criação de despesa...');
      const testExpense = {
        description: 'Teste UUID Fix',
        value: 100.50,
        category: 'Teste',
        date: new Date().toISOString().split('T')[0],
        billing_type: 'unica',
        project_id: projects[0].id // Usando UUID string
      };
      
      const { data: newExpense, error: createError } = await supabase
        .from('expenses')
        .insert(testExpense)
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Erro ao criar despesa:', createError.message);
      } else {
        console.log('✅ Despesa criada com sucesso!');
        console.log('📝 Nova despesa ID:', newExpense.id);
        
        // Limpar teste - deletar a despesa criada
        await supabase.from('expenses').delete().eq('id', newExpense.id);
        console.log('🧹 Despesa de teste removida');
      }
    }
    
    console.log('\n🎉 Teste de correções UUID concluído!');
    
  } catch (error) {
    console.error('💥 Erro durante o teste:', error.message);
  }
}

testUUIDFixes().then(() => {
  console.log('\n✨ Teste finalizado!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});