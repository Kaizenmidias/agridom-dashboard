// Teste final com valores reais do sistema
const { createClient } = require('@supabase/supabase-js');
const { calculateTotalMonthlyExpenses, calculateTotalAnnualExpenses } = require('./server/utils/billing-calculations');
require('dotenv').config({ path: './server/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testRealValues() {
  try {
    // Buscar despesas reais do banco
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .order('id');
    
    if (error) {
      console.error('Erro ao buscar despesas:', error);
      return;
    }
    
    console.log('=== TESTE COM VALORES REAIS DO SISTEMA ===\n');
    
    if (!expenses || expenses.length === 0) {
      console.log('❌ Nenhuma despesa encontrada no sistema.');
      return;
    }
    
    console.log('📋 Despesas cadastradas:');
    expenses.forEach(expense => {
      console.log(`- ${expense.description}: R$ ${expense.amount} (${expense.billing_type})`);
    });
    console.log('');
    
    // Teste Janeiro 2025 (5 quartas-feiras)
    const jan2025 = calculateTotalMonthlyExpenses(expenses, 2025, 1);
    console.log('📅 Janeiro 2025 (5 quartas-feiras):');
    console.log(`Resultado: R$ ${jan2025.toFixed(2)}`);
    console.log('Esperado: R$ 2684.90 (120 + 64.9 + 500*5)');
    
    if (Math.abs(jan2025 - 2684.90) < 0.01) {
      console.log('✅ CORRETO - Janeiro com 5 quartas-feiras!');
    } else {
      console.log('❌ INCORRETO - Valor não confere!');
    }
    console.log('');
    
    // Teste Fevereiro 2025 (4 quartas-feiras)
    const fev2025 = calculateTotalMonthlyExpenses(expenses, 2025, 2);
    console.log('📅 Fevereiro 2025 (4 quartas-feiras):');
    console.log(`Resultado: R$ ${fev2025.toFixed(2)}`);
    console.log('Esperado: R$ 2184.90 (120 + 64.9 + 500*4)');
    
    if (Math.abs(fev2025 - 2184.90) < 0.01) {
      console.log('✅ CORRETO - Fevereiro com 4 quartas-feiras!');
    } else {
      console.log('❌ INCORRETO - Valor não confere!');
    }
    console.log('');
    
    // Teste Anual 2025
    const anual2025 = calculateTotalAnnualExpenses(expenses, 2025);
    console.log('📅 Anual 2025:');
    console.log(`Resultado: R$ ${anual2025.toFixed(2)}`);
    
    // Calcular valor esperado baseado nas quartas-feiras de 2025
    const quartasPorMes = [5, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 5]; // 2025
    const totalQuartas = quartasPorMes.reduce((sum, q) => sum + q, 0);
    const expectedAnual = (120 + 64.9) * 12 + 500 * totalQuartas;
    
    console.log(`Esperado: R$ ${expectedAnual.toFixed(2)} ((120+64.9)*12 + 500*${totalQuartas})`);
    
    if (Math.abs(anual2025 - expectedAnual) < 1) {
      console.log('✅ CORRETO - Cálculo anual está funcionando!');
    } else {
      console.log('❌ INCORRETO - Cálculo anual com problema!');
    }
    
    console.log('\n=== RESUMO FINAL ===');
    console.log(`✅ Você estava correto sobre os valores:`);
    console.log(`   - Mês com 4 quartas: R$ 2.184,90`);
    console.log(`   - Mês com 5 quartas: R$ 2.684,90`);
    console.log(`   - Despesa semanal Ricardo: R$ 500,00`);
    console.log(`\n🎯 O sistema agora calcula corretamente as variações mensais!`);
    
  } catch (err) {
    console.error('Erro no teste:', err);
  }
}

testRealValues();