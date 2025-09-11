// Debug específico para janeiro 2025

function debugJanuary2025() {
  console.log('🔍 Debug detalhado para Janeiro 2025...');
  
  const year = 2025;
  const month = 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  
  console.log(`Ano: ${year}, Mês: ${month}, Dias no mês: ${daysInMonth}`);
  
  // Data da despesa do Ricardo
  const expenseDate = new Date('2025-01-01');
  console.log(`Data da despesa: ${expenseDate}`);
  console.log(`Dia da semana da despesa: ${expenseDate.getDay()} (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab)`);
  
  const dayOfWeek = expenseDate.getDay();
  
  let occurrences = 0;
  let dates = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month - 1, day);
    console.log(`Dia ${day}: ${currentDate.toDateString()}, Dia da semana: ${currentDate.getDay()}`);
    
    if (currentDate.getDay() === dayOfWeek) {
      occurrences++;
      dates.push(day);
      console.log(`  ✅ MATCH! Ocorrência ${occurrences}`);
    }
  }
  
  console.log(`\n📊 Total de ocorrências encontradas: ${occurrences}`);
  console.log(`📅 Datas encontradas: ${dates.join(', ')}`);
  
  return occurrences;
}

const result = debugJanuary2025();
console.log(`\n🎯 Resultado final: ${result} ocorrências`);