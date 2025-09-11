// Teste específico para verificar como a API processa datas de despesas semanais

function testDateProcessing() {
  console.log('🔍 Testando processamento de datas na API...');
  
  // Simular a lógica da API
  const expense = {
    date: '2025-01-01',
    amount: 500,
    billing_type: 'semanal'
  };
  
  const year = 2025;
  const month = 1;
  
  console.log(`\n📅 Despesa: ${expense.date}`);
  console.log(`📊 Calculando para: ${month}/${year}`);
  
  // Teste 1: Processamento original (com problema de fuso horário)
  console.log('\n🔧 Teste 1: Processamento original');
  const expenseDate1 = new Date(expense.date);
  console.log(`Data criada: ${expenseDate1}`);
  console.log(`Dia da semana: ${expenseDate1.getDay()} (${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][expenseDate1.getDay()]})`);
  
  // Teste 2: Processamento com UTC (correção implementada)
  console.log('\n🔧 Teste 2: Processamento com UTC');
  const expenseDate2 = new Date(expense.date + 'T12:00:00.000Z');
  console.log(`Data criada: ${expenseDate2}`);
  console.log(`Dia da semana UTC: ${expenseDate2.getUTCDay()} (${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][expenseDate2.getUTCDay()]})`);
  
  // Contar ocorrências com ambos os métodos
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Método 1: Original
  let occurrences1 = 0;
  const targetDayOfWeek1 = expenseDate1.getDay();
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month - 1, day);
    if (currentDate.getDay() === targetDayOfWeek1) {
      occurrences1++;
    }
  }
  
  // Método 2: UTC
  let occurrences2 = 0;
  const targetDayOfWeek2 = expenseDate2.getUTCDay();
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (currentDate.getUTCDay() === targetDayOfWeek2) {
      occurrences2++;
    }
  }
  
  console.log(`\n📊 Resultados:`);
  console.log(`Método original: ${occurrences1} ocorrências (${targetDayOfWeek1} = ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][targetDayOfWeek1]})`);
  console.log(`Método UTC: ${occurrences2} ocorrências (${targetDayOfWeek2} = ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][targetDayOfWeek2]})`);
  
  console.log(`\n💰 Valores calculados:`);
  console.log(`Método original: R$ ${(expense.amount * occurrences1).toFixed(2)}`);
  console.log(`Método UTC: R$ ${(expense.amount * occurrences2).toFixed(2)}`);
  
  console.log(`\n🎯 Valor esperado: R$ 2500.00 (5 quartas-feiras)`);
  
  if (occurrences2 === 5) {
    console.log('✅ Método UTC está correto!');
  } else {
    console.log('❌ Método UTC ainda não está correto!');
  }
}

testDateProcessing();