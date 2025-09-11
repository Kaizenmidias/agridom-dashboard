// Teste direto das funções de cálculo de despesas
const { format } = require('date-fns');

// Simular as funções de cálculo (copiadas da API)
function calculateMonthlyExpenses(year, month, expenses) {
  console.log(`\n🧮 Calculando despesas para ${month}/${year}`);
  
  const targetDate = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  let totalExpenses = 0;
  
  expenses.forEach(expense => {
    console.log(`\n📋 Processando despesa: ${expense.description}`);
    console.log(`   Tipo: ${expense.frequency}, Valor: R$ ${expense.amount}`);
    
    let expenseAmount = 0;
    
    if (expense.frequency === 'monthly') {
      expenseAmount = expense.amount;
      console.log(`   ✅ Mensal: R$ ${expenseAmount}`);
    } else if (expense.frequency === 'weekly') {
      // Contar quantas ocorrências da data específica há no mês
      // Usar UTC para evitar problemas de fuso horário
      const expenseDate = new Date(expense.date + 'T12:00:00.000Z');
      const dayOfWeek = expenseDate.getUTCDay();
      
      let occurrences = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        if (currentDate.getUTCDay() === dayOfWeek) {
          occurrences++;
        }
      }
      
      expenseAmount = expense.amount * occurrences;
      console.log(`   ✅ Semanal: ${occurrences} ocorrências × R$ ${expense.amount} = R$ ${expenseAmount}`);
    } else if (expense.frequency === 'annual') {
      expenseAmount = expense.amount / 12;
      console.log(`   ✅ Anual: R$ ${expense.amount} ÷ 12 = R$ ${expenseAmount}`);
    } else if (expense.frequency === 'one-time') {
      const expenseDate = new Date(expense.date);
      if (expenseDate.getFullYear() === year && expenseDate.getMonth() + 1 === month) {
        expenseAmount = expense.amount;
        console.log(`   ✅ Única vez: R$ ${expenseAmount}`);
      } else {
        console.log(`   ❌ Única vez: Não aplicável para ${month}/${year}`);
      }
    }
    
    totalExpenses += expenseAmount;
  });
  
  console.log(`\n💰 Total do mês ${month}/${year}: R$ ${totalExpenses.toFixed(2)}`);
  return totalExpenses;
}

function calculateAnnualExpenses(year, expenses) {
  console.log(`\n📊 Calculando despesas anuais para ${year}`);
  
  let totalAnnual = 0;
  
  for (let month = 1; month <= 12; month++) {
    const monthlyTotal = calculateMonthlyExpenses(year, month, expenses);
    totalAnnual += monthlyTotal;
  }
  
  console.log(`\n🎯 Total anual ${year}: R$ ${totalAnnual.toFixed(2)}`);
  return totalAnnual;
}

// Dados de teste (baseados nas despesas reais)
const testExpenses = [
  {
    description: 'Workana',
    amount: 120,
    frequency: 'monthly',
    date: '2025-01-01'
  },
  {
    description: 'Ricardo',
    amount: 500,
    frequency: 'weekly',
    date: '2025-01-01' // Quarta-feira (1º de janeiro de 2025)
  },
  {
    description: 'Turbo Cloud',
    amount: 64.90,
    frequency: 'monthly',
    date: '2025-01-01'
  }
];

console.log('🧪 Testando cálculos de despesas...');
console.log('📋 Despesas de teste:', testExpenses);

// Teste 1: Janeiro 2025 (5 quartas-feiras)
const jan2025 = calculateMonthlyExpenses(2025, 1, testExpenses);

// Teste 2: Fevereiro 2025 (4 quartas-feiras)
const feb2025 = calculateMonthlyExpenses(2025, 2, testExpenses);

// Teste 3: Anual 2025
const annual2025 = calculateAnnualExpenses(2025, testExpenses);

console.log('\n📊 RESUMO DOS RESULTADOS:');
console.log(`Janeiro 2025: R$ ${jan2025.toFixed(2)}`);
console.log(`Fevereiro 2025: R$ ${feb2025.toFixed(2)}`);
console.log(`Anual 2025: R$ ${annual2025.toFixed(2)}`);

// Verificações
if (jan2025 !== feb2025) {
  console.log('\n✅ SUCESSO: Valores mensais são diferentes!');
  console.log(`   Diferença: R$ ${Math.abs(jan2025 - feb2025).toFixed(2)}`);
} else {
  console.log('\n❌ ERRO: Valores mensais são iguais!');
}

if (annual2025 > jan2025 && annual2025 > feb2025) {
  console.log('✅ SUCESSO: Valor anual é maior que os mensais!');
} else {
  console.log('❌ ERRO: Valor anual não está correto!');
}

// Valores esperados
const expectedJan = 120 + (500 * 5) + 64.90; // 2684.90
const expectedFeb = 120 + (500 * 4) + 64.90; // 2184.90

console.log('\n🎯 VALORES ESPERADOS:');
console.log(`Janeiro 2025: R$ ${expectedJan.toFixed(2)}`);
console.log(`Fevereiro 2025: R$ ${expectedFeb.toFixed(2)}`);

if (Math.abs(jan2025 - expectedJan) < 0.01) {
  console.log('✅ Janeiro: Valor correto!');
} else {
  console.log(`❌ Janeiro: Esperado R$ ${expectedJan.toFixed(2)}, obtido R$ ${jan2025.toFixed(2)}`);
}

if (Math.abs(feb2025 - expectedFeb) < 0.01) {
  console.log('✅ Fevereiro: Valor correto!');
} else {
  console.log(`❌ Fevereiro: Esperado R$ ${expectedFeb.toFixed(2)}, obtido R$ ${feb2025.toFixed(2)}`);
}