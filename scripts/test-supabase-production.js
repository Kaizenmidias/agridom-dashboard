// Script para testar o Supabase em produção
// Execute este script no console do navegador em produção

(async function testSupabaseProduction() {
  console.log('🔍 === TESTE SUPABASE EM PRODUÇÃO ===');
  
  // 1. Verificar variáveis de ambiente
  console.log('\n📋 1. Verificando variáveis de ambiente...');
  console.log('VITE_SUPABASE_URL:', import.meta?.env?.VITE_SUPABASE_URL || 'NÃO DEFINIDA');
  console.log('VITE_SUPABASE_ANON_KEY:', import.meta?.env?.VITE_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA');
  console.log('Environment mode:', import.meta?.env?.MODE || 'DESCONHECIDO');
  
  // 2. Verificar se o cliente Supabase está disponível
  console.log('\n🔌 2. Verificando cliente Supabase...');
  if (typeof window !== 'undefined' && window.supabase) {
    console.log('✅ Cliente Supabase encontrado no window');
  } else {
    console.log('❌ Cliente Supabase NÃO encontrado no window');
  }
  
  // 3. Tentar importar o cliente Supabase
  try {
    console.log('\n📦 3. Tentando importar cliente Supabase...');
    const { supabase } = await import('/src/lib/supabase.ts');
    console.log('✅ Cliente Supabase importado com sucesso');
    
    // 4. Testar conexão com projects
    console.log('\n📊 4. Testando consulta de projetos...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .limit(5);
    
    if (projectsError) {
      console.error('❌ Erro ao buscar projetos:', projectsError);
    } else {
      console.log('✅ Projetos encontrados:', projects?.length || 0);
      if (projects && projects.length > 0) {
        console.log('Primeiro projeto:', projects[0]);
      }
    }
    
    // 5. Testar conexão com codes
    console.log('\n🏷️ 5. Testando consulta de códigos...');
    const { data: codes, error: codesError } = await supabase
      .from('codes')
      .select('*')
      .limit(5);
    
    if (codesError) {
      console.error('❌ Erro ao buscar códigos:', codesError);
    } else {
      console.log('✅ Códigos encontrados:', codes?.length || 0);
    }
    
    // 6. Testar conexão com expenses
    console.log('\n💰 6. Testando consulta de despesas...');
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .limit(5);
    
    if (expensesError) {
      console.error('❌ Erro ao buscar despesas:', expensesError);
    } else {
      console.log('✅ Despesas encontradas:', expenses?.length || 0);
    }
    
    // 7. Verificar Network tab
    console.log('\n🌐 7. Verificação de rede:');
    console.log('Abra o DevTools → Network e procure por chamadas para:');
    console.log('- https://qwbpruywwfjadkudegcj.supabase.co/rest/v1/projects');
    console.log('- https://qwbpruywwfjadkudegcj.supabase.co/rest/v1/codes');
    console.log('- https://qwbpruywwfjadkudegcj.supabase.co/rest/v1/expenses');
    
  } catch (importError) {
    console.error('❌ Erro ao importar cliente Supabase:', importError);
  }
  
  console.log('\n🎯 === FIM DO TESTE ===');
})();

// Função para testar manualmente
window.testSupabase = async function() {
  try {
    const { supabase } = await import('/src/lib/supabase.ts');
    const { data, error } = await supabase.from('projects').select('*').limit(1);
    console.log('Teste manual - Data:', data);
    console.log('Teste manual - Error:', error);
    return { data, error };
  } catch (err) {
    console.error('Erro no teste manual:', err);
    return { error: err };
  }
};

console.log('\n💡 Para testar manualmente, execute: testSupabase()');