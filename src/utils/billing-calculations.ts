// Utilitários para cálculos de cobrança recorrente

/**
 * Calcula quantas vezes um dia da semana específico ocorre em um mês
 * @param year - Ano
 * @param month - Mês (1-12)
 * @param dayOfWeek - Dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
 * @returns Número de ocorrências do dia da semana no mês
 */
export function getWeekdayOccurrencesInMonth(year: number, month: number, dayOfWeek: number): number {
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
 * @param weeklyAmount - Valor da despesa semanal
 * @param year - Ano de referência
 * @param month - Mês de referência (1-12)
 * @param dayOfWeek - Dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
 * @returns Valor total mensal
 */
export function calculateWeeklyMonthlyAmount(weeklyAmount: number, year: number, month: number, dayOfWeek: number): number {
  const occurrences = getWeekdayOccurrencesInMonth(year, month, dayOfWeek);
  return weeklyAmount * occurrences;
}

/**
 * Calcula o valor mensal de uma despesa recorrente anual
 * @param annualAmount - Valor da despesa anual
 * @returns Valor mensal (anual dividido por 12)
 */
export function calculateAnnualMonthlyAmount(annualAmount: number): number {
  return annualAmount / 12;
}

/**
 * Obtém o dia da semana de uma data
 * @param date - Data no formato YYYY-MM-DD
 * @returns Dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
 */
export function getDayOfWeekFromDate(date: string): number {
  // Criar a data no fuso horário local para evitar problemas de UTC
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * Calcula o valor mensal baseado no tipo de cobrança
 * @param amount - Valor base da despesa
 * @param billingType - Tipo de cobrança ('unica', 'semanal', 'mensal', 'anual')
 * @param date - Data da despesa (para calcular dia da semana)
 * @param targetYear - Ano para o cálculo (opcional, padrão: ano atual)
 * @param targetMonth - Mês para o cálculo (opcional, padrão: mês atual)
 * @returns Valor mensal calculado
 */
export function calculateMonthlyAmount(
  amount: number,
  billingType: 'unica' | 'semanal' | 'mensal' | 'anual',
  date: string,
  targetYear?: number,
  targetMonth?: number
): number {
  const now = new Date();
  const year = targetYear || new Date().getFullYear();
  const month = targetMonth || (now.getMonth() + 1);

  switch (billingType) {
    case 'unica':
      // Para despesas únicas, verificar se está no mês/ano correto
      const [expenseYear, expenseMonth] = date.split('-').map(Number);
      if (expenseYear === year && expenseMonth === month) {
        return amount;
      }
      return 0;
    case 'semanal':
      const dayOfWeek = getDayOfWeekFromDate(date);
      return calculateWeeklyMonthlyAmount(amount, year, month, dayOfWeek);
    case 'mensal':
      // Despesas mensais devem aparecer em todos os meses
      return amount;
    case 'anual':
      // Despesas anuais devem aparecer em todos os meses (divididas por 12)
      return calculateAnnualMonthlyAmount(amount);
    default:
      return amount;
  }
}

/**
 * Gera as datas de recorrência para uma despesa semanal em um mês específico
 * @param startDate - Data inicial da despesa
 * @param year - Ano
 * @param month - Mês (1-12)
 * @returns Array de datas no formato YYYY-MM-DD
 */
export function generateWeeklyRecurrenceDates(startDate: string, year: number, month: number): string[] {
  const dayOfWeek = getDayOfWeekFromDate(startDate);
  const dates: string[] = [];
  
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  const currentDate = new Date(firstDay);
  
  while (currentDate <= lastDay) {
    if (currentDate.getDay() === dayOfWeek) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dates.push(dateStr);
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}