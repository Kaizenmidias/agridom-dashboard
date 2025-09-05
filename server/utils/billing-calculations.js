// Utilitários para cálculos de cobrança recorrente no backend

/**
 * Calcula quantas vezes um dia da semana específico ocorre em um mês
 * @param {number} year - Ano
 * @param {number} month - Mês (1-12)
 * @param {number} dayOfWeek - Dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
 * @returns {number} Número de ocorrências do dia da semana no mês
 */
function getWeekdayOccurrencesInMonth(year, month, dayOfWeek) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  let count = 0;
  const currentDate = new Date(firstDay);
  
  while (currentDate <= lastDay) {
    if (currentDate.getDay() === dayOfWeek) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return count;
}

/**
 * Calcula o valor mensal de uma despesa recorrente semanal
 * @param {number} weeklyAmount - Valor da despesa semanal
 * @param {number} year - Ano de referência
 * @param {number} month - Mês de referência (1-12)
 * @param {number} dayOfWeek - Dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
 * @returns {number} Valor total mensal
 */
function calculateWeeklyMonthlyAmount(weeklyAmount, year, month, dayOfWeek) {
  const occurrences = getWeekdayOccurrencesInMonth(year, month, dayOfWeek);
  return weeklyAmount * occurrences;
}

/**
 * Calcula o valor mensal de uma despesa recorrente anual
 * @param {number} annualAmount - Valor da despesa anual
 * @returns {number} Valor mensal (anual dividido por 12)
 */
function calculateAnnualMonthlyAmount(annualAmount) {
  return annualAmount / 12;
}

/**
 * Obtém o dia da semana de uma data
 * @param {string} date - Data no formato YYYY-MM-DD
 * @returns {number} Dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
 */
function getDayOfWeekFromDate(date) {
  // Criar a data no fuso horário local para evitar problemas de UTC
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * Calcula o valor mensal baseado no tipo de cobrança
 * @param {number} amount - Valor base da despesa
 * @param {string} billingType - Tipo de cobrança ('unica', 'semanal', 'mensal', 'anual')
 * @param {string} date - Data da despesa (para calcular dia da semana)
 * @param {number} targetYear - Ano para o cálculo (opcional, padrão: ano atual)
 * @param {number} targetMonth - Mês para o cálculo (opcional, padrão: mês atual)
 * @returns {number} Valor mensal calculado
 */
function calculateMonthlyAmount(
  amount,
  billingType,
  date,
  targetYear,
  targetMonth
) {
  const now = new Date();
  const year = targetYear || now.getFullYear();
  const month = targetMonth || (now.getMonth() + 1);
  const numericAmount = parseFloat(amount) || 0;

  switch (billingType) {
    case 'unica':
      // Para despesas únicas, só contar se a data está no mês/ano alvo
      // Usar parsing manual para evitar problemas de fuso horário
      const [expenseYear, expenseMonth] = date.split('-').map(Number);
      
      if (expenseYear === year && expenseMonth === month) {
        return numericAmount;
      }
      return 0;
    case 'semanal':
      const dayOfWeek = getDayOfWeekFromDate(date);
      return calculateWeeklyMonthlyAmount(numericAmount, year, month, dayOfWeek);
    case 'mensal':
      return numericAmount;
    case 'anual':
      return calculateAnnualMonthlyAmount(numericAmount);
    default:
      // Para tipos desconhecidos, tratar como única
      // Usar parsing manual para evitar problemas de fuso horário
      const [unknownExpenseYear, unknownExpenseMonth] = date.split('-').map(Number);
      
      if (unknownExpenseYear === year && unknownExpenseMonth === month) {
        return numericAmount;
      }
      return 0;
  }
}

/**
 * Calcula o total mensal de um array de despesas
 * @param {Array} expenses - Array de despesas
 * @param {number} targetYear - Ano para o cálculo
 * @param {number} targetMonth - Mês para o cálculo
 * @returns {number} Total mensal calculado
 */
function calculateTotalMonthlyExpenses(expenses, targetYear, targetMonth) {
  return expenses.reduce((total, expense) => {
    // Usar date
    const expenseDate = expense.date;
    // Tentar acessar tanto 'amount' quanto 'value' para compatibilidade
    const expenseValue = expense.amount || expense.value || 0;
    const monthlyAmount = calculateMonthlyAmount(
      parseFloat(expenseValue),
      expense.billing_type || 'unica',
      expenseDate,
      targetYear,
      targetMonth
    );
    return parseFloat(total) + parseFloat(monthlyAmount);
  }, 0);
}

module.exports = {
  getWeekdayOccurrencesInMonth,
  calculateWeeklyMonthlyAmount,
  calculateAnnualMonthlyAmount,
  getDayOfWeekFromDate,
  calculateMonthlyAmount,
  calculateTotalMonthlyExpenses
};