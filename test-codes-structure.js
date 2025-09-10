const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qwbpruywwfjadkudegcj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YnBydXl3d2ZqYWRrdWRlZ2NqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk2MzI1MCwiZXhwIjoyMDcyNTM5MjUwfQ.5q5dHv8Xn5QMtiTPJEpEIg8gcCM_tKstzCsEuBV2dwM'
);

async function testCodesStructure() {
  console.log('🔍 Testando estrutura da tabela codes...');
  
  try {
    // Teste 1: Inserir apenas com title e language (obrigatórios)
    console.log('\n1️⃣ Teste com campos mínimos:');
    const result1 = await supabase
      .from('codes')
      .insert([{
        title: 'Test Code',
        language: 'javascript',
        user_id: 27
      }])
      .select();
    
    console.log('Resultado:', JSON.stringify(result1, null, 2));
    
    // Teste 1b: Tentar com description
    console.log('\n1️⃣b Teste com description:');
    const result1b = await supabase
      .from('codes')
      .insert([{
        title: 'Test Code 2',
        description: 'Test description',
        language: 'javascript',
        user_id: 27
      }])
      .select();
    
    console.log('Resultado com description:', JSON.stringify(result1b, null, 2));
    
    // Teste 2: Verificar se existe algum registro
    console.log('\n2️⃣ Verificando registros existentes:');
    const result2 = await supabase
      .from('codes')
      .select('*')
      .limit(1);
    
    console.log('Registros existentes:', JSON.stringify(result2, null, 2));
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testCodesStructure();