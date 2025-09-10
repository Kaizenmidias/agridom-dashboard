// Script para testar se o frontend está usando o Supabase corretamente
// Execute este script no console do navegador (F12 > Console)

console.log('🔍 TESTE DE INTEGRAÇÃO FRONTEND-SUPABASE');
console.log('==========================================');

// 1. Verificar variáveis de ambiente
console.log('\n1. VERIFICANDO VARIÁVEIS DE AMBIENTE:');
console.log('VITE_SUPABASE_URL:', import.meta?.env?.VITE_SUPABASE_URL || 'UNDEFINED');
console.log('VITE_SUPABASE_ANON_KEY:', import.meta?.env?.VITE_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'UNDEFINED');

// 2. Verificar se o cliente Supabase está disponível
console.log('\n2. VERIFICANDO CLIENTE SUPABASE:');
try {
  // Tentar importar o cliente Supabase
  const { supabase } = await import('/src/lib/supabase.ts');
  console.log('✅ Cliente Supabase importado com sucesso');
  console.log('Supabase URL:', supabase.supabaseUrl);
  console.log('Supabase Key:', supabase.supabaseKey ? 'DEFINIDA' : 'UNDEFINED');
  
  // 3. Testar conexão com as tabelas
  console.log('\n3. TESTANDO CONEXÃO COM TABELAS:');
  
  // Teste Projects
  try {
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .limit(5);
    
    if (projectsError) {
      console.error('❌ Erro ao buscar projects:', projectsError);
    } else {
      console.log('✅ Projects encontrados:', projects?.length || 0);
      console.log('Dados:', projects);
    }
  } catch (err) {
    console.error('❌ Erro na consulta projects:', err);
  }
  
  // Teste Codes
  try {
    const { data: codes, error: codesError } = await supabase
      .from('codes')
      .select('*')
      .limit(5);
    
    if (codesError) {
      console.error('❌ Erro ao buscar codes:', codesError);
    } else {
      console.log('✅ Codes encontrados:', codes?.length || 0);
      console.log('Dados:', codes);
    }
  } catch (err) {
    console.error('❌ Erro na consulta codes:', err);
  }
  
  // Teste Expenses
  try {
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .limit(5);
    
    if (expensesError) {
      console.error('❌ Erro ao buscar expenses:', expensesError);
    } else {
      console.log('✅ Expenses encontradas:', expenses?.length || 0);
      console.log('Dados:', expenses);
    }
  } catch (err) {
    console.error('❌ Erro na consulta expenses:', err);
  }
  
  // 4. Testar inserção
  console.log('\n4. TESTANDO INSERÇÃO (PROJETO DE TESTE):');
  try {
    const testProject = {
      name: 'Projeto Teste Frontend',
      description: 'Teste de inserção via frontend',
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    const { data: insertResult, error: insertError } = await supabase
      .from('projects')
      .insert([testProject])
      .select();
    
    if (insertError) {
      console.error('❌ Erro ao inserir projeto teste:', insertError);
    } else {
      console.log('✅ Projeto teste inserido com sucesso:', insertResult);
      
      // Limpar o projeto teste
      if (insertResult && insertResult[0]) {
        await supabase
          .from('projects')
          .delete()
          .eq('id', insertResult[0].id);
        console.log('🧹 Projeto teste removido');
      }
    }
  } catch (err) {
    console.error('❌ Erro no teste de inserção:', err);
  }
  
} catch (importError) {
  console.error('❌ Erro ao importar cliente Supabase:', importError);
}

// 5. Verificar chamadas de rede
console.log('\n5. MONITORAMENTO DE REDE:');
console.log('Abra DevTools > Network e filtre por "supabase" para ver as chamadas');
console.log('Você deve ver chamadas para: https://qwbpruywwfjadkudegcj.supabase.co/rest/v1/');

console.log('\n==========================================');
console.log('✅ TESTE CONCLUÍDO');
console.log('Verifique os logs acima para identificar problemas');