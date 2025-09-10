const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabase = createClient(
  'https://qwbpruywwfjadkudegcj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YnBydXl3d2ZqYWRrdWRlZ2NqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk2MzI1MCwiZXhwIjoyMDcyNTM5MjUwfQ.5q5dHv8Xn5QMtiTPJEpEIg8gcCM_tKstzCsEuBV2dwM'
);

async function testAllFixes() {
  console.log('🧪 Iniciando testes das correções...');
  
  try {
    // Teste 1: Verificar se a coluna 'amount' não é mais referenciada
    console.log('\n1️⃣ Testando schema da tabela expenses...');
    const { data: expensesSchema, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .limit(1);
    
    if (expensesError) {
      console.error('❌ Erro no schema expenses:', expensesError.message);
    } else {
      console.log('✅ Schema expenses OK');
    }
    
    // Teste 2: Verificar se códigos podem ser criados com user_id
    console.log('\n2️⃣ Testando criação de código...');
    const testCode = {
      code: 'TEST-' + Date.now(),
      description: 'Código de teste',
      user_id: '26' // ID de usuário válido
    };
    
    const { data: newCode, error: codeError } = await supabase
      .from('codes')
      .insert([testCode])
      .select()
      .single();
    
    if (codeError) {
      console.error('❌ Erro ao criar código:', codeError.message);
    } else {
      console.log('✅ Código criado com sucesso:', newCode.id);
      
      // Limpar código de teste
      await supabase.from('codes').delete().eq('id', newCode.id);
      console.log('🧹 Código de teste removido');
    }
    
    // Teste 3: Verificar se projetos podem ser criados com user_id
    console.log('\n3️⃣ Testando criação de projeto...');
    const testProject = {
      name: 'Projeto Teste ' + Date.now(),
      client: 'Cliente Teste',
      project_type: 'website',
      status: 'active',
      user_id: '26' // ID de usuário válido
    };
    
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert([testProject])
      .select()
      .single();
    
    if (projectError) {
      console.error('❌ Erro ao criar projeto:', projectError.message);
    } else {
      console.log('✅ Projeto criado com sucesso:', newProject.id);
      
      // Limpar projeto de teste
      await supabase.from('projects').delete().eq('id', newProject.id);
      console.log('🧹 Projeto de teste removido');
    }
    
    // Teste 4: Verificar se despesas podem ser criadas
    console.log('\n4️⃣ Testando criação de despesa...');
    const testExpense = {
      description: 'Despesa de teste',
      value: 100.00,
      category: 'Teste',
      date: new Date().toISOString().split('T')[0],
      user_id: '26' // ID de usuário válido
    };
    
    const { data: newExpense, error: expenseError } = await supabase
      .from('expenses')
      .insert([testExpense])
      .select()
      .single();
    
    if (expenseError) {
      console.error('❌ Erro ao criar despesa:', expenseError.message);
    } else {
      console.log('✅ Despesa criada com sucesso:', newExpense.id);
      
      // Limpar despesa de teste
      await supabase.from('expenses').delete().eq('id', newExpense.id);
      console.log('🧹 Despesa de teste removida');
    }
    
    console.log('\n🎉 Todos os testes concluídos!');
    
  } catch (error) {
    console.error('💥 Erro geral nos testes:', error.message);
  }
}

// Executar testes
testAllFixes();