const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkExpenses() {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('id');
    
    if (error) {
      console.error('Erro ao buscar despesas:', error);
      return;
    }
    
    console.log('=== DESPESAS CADASTRADAS NO SISTEMA ===');
    console.log('');
    
    if (!data || data.length === 0) {
      console.log('Nenhuma despesa encontrada.');
      return;
    }
    
    let totalMensal = 0;
    
    data.forEach(expense => {
      console.log(`ID: ${expense.id}`);
      console.log(`Descrição: ${expense.description}`);
      console.log(`Valor: R$ ${expense.amount}`);
      console.log(`Tipo de Cobrança: ${expense.billing_type}`);
      console.log(`Data: ${expense.date}`);
      console.log(`---`);
      
      // Calcular valor mensal aproximado
      if (expense.billing_type === 'mensal') {
        totalMensal += parseFloat(expense.amount) || 0;
      } else if (expense.billing_type === 'semanal') {
        // Assumir 4.33 semanas por mês em média
        totalMensal += (parseFloat(expense.amount) || 0) * 4.33;
      } else if (expense.billing_type === 'anual') {
        totalMensal += (parseFloat(expense.amount) || 0) / 12;
      }
    });
    
    console.log('');
    console.log(`=== RESUMO ===`);
    console.log(`Total de despesas: ${data.length}`);
    console.log(`Valor mensal aproximado: R$ ${totalMensal.toFixed(2)}`);
    
  } catch (err) {
    console.error('Erro:', err);
  }
}

checkExpenses();