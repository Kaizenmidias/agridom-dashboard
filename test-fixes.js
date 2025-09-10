const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://qwbpruywwfjadkudegcj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YnBydXl3d2ZqYWRrdWRlZ2NqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk2MzI1MCwiZXhwIjoyMDcyNTM5MjUwfQ.5q5dHv8Xn5QMtiTPJEpEIg8gcCM_tKstzCsEuBV2dwM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFixes() {
  console.log('🧪 Testando correções implementadas...');
  
  try {
    // 1. Testar se a tabela expenses tem a coluna 'value' (não 'amount')
    console.log('\n1. Verificando schema da tabela expenses...');
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('id, value, description, category, date, billing_type')
      .limit(1);
    
    if (expensesError) {
      console.error('❌ Erro ao consultar expenses:', expensesError.message);
    } else {
      console.log('✅ Tabela expenses acessível com coluna value');
      console.log('Exemplo de registro:', expensesData[0] || 'Nenhum registro encontrado');
    }
    
    // 2. Verificar se existe mapeamento de usuários
    console.log('\n2. Verificando mapeamento de usuários...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, email, auth_user_id')
      .limit(3);
    
    if (usersError) {
      console.error('❌ Erro ao consultar users:', usersError.message);
    } else {
      console.log('✅ Tabela users acessível');
      console.log('Usuários encontrados:', usersData.length);
      if (usersData.length > 0) {
        console.log('Exemplo:', {
          id: usersData[0].id,
          email: usersData[0].email,
          auth_user_id: usersData[0].auth_user_id ? 'UUID presente' : 'UUID ausente'
        });
      }
    }
    
    // 3. Verificar tabela codes
    console.log('\n3. Verificando tabela codes...');
    const { data: codesData, error: codesError } = await supabase
      .from('codes')
      .select('id, user_id, title, language')
      .limit(1);
    
    if (codesError) {
      console.error('❌ Erro ao consultar codes:', codesError.message);
    } else {
      console.log('✅ Tabela codes acessível');
      console.log('Exemplo de registro:', codesData[0] || 'Nenhum registro encontrado');
    }
    
    // 4. Verificar tabela projects
    console.log('\n4. Verificando tabela projects...');
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('id, user_id, name, status')
      .limit(1);
    
    if (projectsError) {
      console.error('❌ Erro ao consultar projects:', projectsError.message);
    } else {
      console.log('✅ Tabela projects acessível');
      console.log('Exemplo de registro:', projectsData[0] || 'Nenhum registro encontrado');
    }
    
    console.log('\n🎉 Teste de correções concluído!');
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
  }
}

testFixes();