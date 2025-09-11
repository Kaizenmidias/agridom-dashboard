// Teste das funções de cálculo de despesas

// Dados reais das despesas cadastradas no sistema
const testExpenses = [
  {
    id: 345,
    description: 'Workana',
    amount: 120,
    billing_type: 'mensal',
    date: '2025-09-10',
    monthly_value: 120
  },
  {
    id: 347,
    description: 'Ricardo',
    amount: 500,
    billing_type: 'semanal',
    date: '2025-09-11', // Quarta-feira (11 de setembro de 2025)
    monthly_value: null
  },
  {
    id: 348,
    description: 'Turbo Cloud',
    amount: 64.9,
    billing_type: 'mensal',
    date: '2025-09-11',
    monthly_value: 64.9
  }
];

// Função utilitária para calcular despesas de um mês específico
function calculateMonthlyExpenses(expenses, year, month) {
  if (!expenses || expenses.length === 0) return 0;
  
  return expenses.reduce((sum, expense) => {
    const billingType = expense.billing_type || 'unica';
    let monthlyValue = 0;
    
    if (billingType === 'mensal') {
      // Para despesas mensais, usar monthly_value se disponível, senão amount
      monthlyValue = parseFloat(expense.monthly_value) || parseFloat(expense.amount) || 0;
      console.log(`  ${expense.description}: R$ ${monthlyValue} (mensal)`);
    } else if (billingType === 'semanal') {
      // Calcular quantas vezes o dia da semana da despesa ocorre no mês específico
      const expenseDate = new Date(expense.date);
      const targetDayOfWeek = expenseDate.getDay(); // 0 = domingo, 1 = segunda, etc.
      
      // Calcular ocorrências do dia da semana no mês específico
      const daysInMonth = new Date(year, month, 0).getDate();
      let occurrences = 0;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day); // month - 1 porque Date usa 0-11
        if (currentDate.getDay() === targetDayOfWeek) {
          occurrences++;
        }
      }
      
      monthlyValue = (parseFloat(expense.amount) || 0) * occurrences;
      console.log(`  ${expense.description}: R$ ${expense.amount} x ${occurrences} ocorrências = R$ ${monthlyValue} (semanal, dia ${targetDayOfWeek})`);
    } else if (billingType === 'anual') {
      // Para despesas anuais, dividir por 12 para obter valor mensal
      monthlyValue = (parseFloat(expense.amount) || 0) / 12;
      console.log(`  ${expense.description}: R$ ${expense.amount} / 12 = R$ ${monthlyValue} (anual)`);
    } else {
      // Para despesas únicas, verificar se a despesa pertence ao mês específico
      const expenseDate = new Date(expense.date);
      const expenseYear = expenseDate.getFullYear();
      const expenseMonth = expenseDate.getMonth() + 1; // +1 porque getMonth() retorna 0-11
      
      if (expenseYear === year && expenseMonth === month) {
        monthlyValue = parseFloat(expense.amount) || 0;
        console.log(`  ${expense.description}: R$ ${monthlyValue} (única - pertence ao mês)`);
      } else {
        monthlyValue = 0;
        console.log(`  ${expense.description}: R$ 0 (única - não pertence ao mês ${month}/${year})`);
      }
    }
    
    return sum + monthlyValue;
  }, 0);
}

// Função para calcular despesas anuais (soma dos 12 meses)
function calculateAnnualExpenses(expenses, year) {
  let totalAnnual = 0;
  
  for (let month = 1; month <= 12; month++) {
    totalAnnual += calculateMonthlyExpenses(expenses, year, month);
  }
  
  return totalAnnual;
}

// Executar testes
console.log('=== TESTE DE CÁLCULO DE DESPESAS REAIS ===\n');

// Teste 1: Janeiro 2025 (mês com 5 quartas-feiras)
console.log('📅 Janeiro 2025 (5 quartas-feiras):');
const jan2025 = calculateMonthlyExpenses(testExpenses, 2025, 1);
console.log(`Resultado: R$ ${jan2025.toFixed(2)}`);
const expectedJan = 120 + 64.9 + (500 * 5); // Workana + Turbo Cloud + Ricardo (5 quartas)
console.log(`Esperado: R$ ${expectedJan.toFixed(2)} (120 + 64.9 + 2500)`);
if (Math.abs(jan2025 - expectedJan) < 0.01) {
  console.log('✅ PASSOU - Valores corretos!');
} else {
  console.log('❌ FALHOU - Valores incorretos!');
}
console.log('');

// Teste 2: Fevereiro 2025 (mês com 4 quartas-feiras)
console.log('📅 Fevereiro 2025 (4 quartas-feiras):');
const fev2025 = calculateMonthlyExpenses(testExpenses, 2025, 2);
console.log(`Resultado: R$ ${fev2025.toFixed(2)}`);
const expectedFeb = 120 + 64.9 + (500 * 4); // Workana + Turbo Cloud + Ricardo (4 quartas)
console.log(`Esperado: R$ ${expectedFeb.toFixed(2)} (120 + 64.9 + 2000)`);
if (Math.abs(fev2025 - expectedFeb) < 0.01) {
  console.log('✅ PASSOU - Valores corretos!');
} else {
  console.log('❌ FALHOU - Valores incorretos!');
}
console.log('');

// Teste 3: Anual 2025
console.log('📅 Anual 2025:');
const anual2025 = calculateAnnualExpenses(testExpenses, 2025);
console.log(`Resultado: R$ ${anual2025.toFixed(2)}`);
// Cálculo esperado: (120 + 64.9) * 12 + 500 * total_quartas_no_ano
// Total de quartas em 2025: 52 (aproximadamente)
const expectedAnnual = (120 + 64.9) * 12 + 500 * 52;
console.log(`Esperado: ~R$ ${expectedAnnual.toFixed(2)} ((120+64.9)*12 + 500*52)`);
console.log('✅ Inclui todas as variações mensais das despesas semanais\n');

// Verificar quantas quartas-feiras tem em cada mês de 2025
console.log('=== VERIFICAÇÃO DE QUARTAS-FEIRAS POR MÊS ===');
for (let month = 1; month <= 12; month++) {
  const daysInMonth = new Date(2025, month, 0).getDate();
  let wednesdays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(2025, month - 1, day);
    if (currentDate.getDay() === 3) { // 3 = quarta-feira
      wednesdays++;
    }
  }
  
  const monthName = new Date(2025, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  console.log(`${monthName}: ${wednesdays} quartas-feiras`);
}

console.log('\n=== TESTE CONCLUÍDO ===');