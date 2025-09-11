require('dotenv').config({ path: '.env.production' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testExpenses() {
  console.log('🔍 Testando consulta de despesas...');
  
  // Testar sem filtro de user_id
  const { data: allExpenses, error: allError } = await supabase
    .from('expenses')
    .select('*')
    .limit(5);
    
  if (allError) {
    console.error('❌ Erro ao buscar todas as despesas:', allError);
  } else {
    console.log('✅ Despesas encontradas (sem filtro):', {
      count: allExpenses?.length || 0,
      expenses: allExpenses?.map(e => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        value: e.value,
        user_id: e.user_id,
        date: e.date
      }))
    });
  }
  
  // Testar com user_id específico
  const testUserId = '707fd228-9a0c-4fb5-aa87-7ea78e607e4a';
  const { data: userExpenses, error: userError } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', testUserId)
    .limit(5);
    
  if (userError) {
    console.error('❌ Erro ao buscar despesas do usuário:', userError);
  } else {
    console.log('✅ Despesas do usuário encontradas:', {
      count: userExpenses?.length || 0,
      expenses: userExpenses?.map(e => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        value: e.value,
        user_id: e.user_id,
        date: e.date
      }))
    });
  }
}

testExpenses().catch(console.error);