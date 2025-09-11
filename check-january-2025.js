// Verificar quantas quartas-feiras há em janeiro de 2025

function checkWednesdaysInJanuary2025() {
  console.log('📅 Verificando quartas-feiras em Janeiro 2025...');
  
  const year = 2025;
  const month = 1; // Janeiro
  const daysInMonth = new Date(year, month, 0).getDate(); // 31 dias
  
  console.log(`Janeiro ${year} tem ${daysInMonth} dias`);
  
  // 1º de janeiro de 2025 é que dia da semana?
  const firstDay = new Date(2025, 0, 1); // 1º de janeiro
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  console.log(`1º de janeiro de 2025 é ${dayNames[firstDay.getDay()]}`);
  
  // Contar quartas-feiras (dia da semana = 3)
  let wednesdays = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month - 1, day);
    if (currentDate.getDay() === 3) { // Quarta-feira
      wednesdays.push(day);
    }
  }
  
  console.log(`\n🗓️ Quartas-feiras em Janeiro 2025:`);
  wednesdays.forEach(day => {
    const date = new Date(2025, 0, day);
    console.log(`   ${day}/01/2025 (${dayNames[date.getDay()]})`);
  });
  
  console.log(`\n📊 Total de quartas-feiras: ${wednesdays.length}`);
  
  // Calcular despesa do Ricardo
  const ricardoWeekly = 500;
  const ricardoMonthly = ricardoWeekly * wednesdays.length;
  console.log(`💰 Despesa do Ricardo em Janeiro 2025: ${wednesdays.length} × R$ ${ricardoWeekly} = R$ ${ricardoMonthly}`);
  
  // Total com outras despesas
  const workana = 120;
  const turboCloud = 64.90;
  const total = workana + ricardoMonthly + turboCloud;
  console.log(`💰 Total Janeiro 2025: R$ ${workana} + R$ ${ricardoMonthly} + R$ ${turboCloud} = R$ ${total}`);
}

checkWednesdaysInJanuary2025();