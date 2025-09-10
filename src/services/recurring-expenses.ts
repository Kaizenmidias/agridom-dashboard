// Serviço para gerenciar despesas recorrentes

import { createExpense, getExpenses } from '@/api/crud';
import { Expense } from '@/types/database';
import { generateWeeklyRecurrenceDates, getDayOfWeekFromDate } from '@/utils/billing-calculations';

/**
 * Gera despesas recorrentes para um período específico
 * @param originalExpense - Despesa original que serve como modelo
 * @param year - Ano para gerar as recorrências
 * @param month - Mês para gerar as recorrências (1-12)
 * @returns Array de despesas criadas
 */
export async function generateRecurringExpenses(
  originalExpense: Expense,
  year: number,
  month: number
): Promise<Expense[]> {
  const createdExpenses: Expense[] = [];

  if (!originalExpense.is_recurring || originalExpense.billing_type === 'unica') {
    return createdExpenses;
  }

  try {
    switch (originalExpense.billing_type) {
      case 'semanal':
        const weeklyDates = generateWeeklyRecurrenceDates(originalExpense.expense_date, year, month);
        
        for (const date of weeklyDates) {
          // Verificar se já existe uma despesa para esta data
          const existingExpenses = await getExpenses();
          const alreadyExists = existingExpenses.some(expense => 
            expense.original_expense_id === originalExpense.id && 
            expense.expense_date === date
          );

          if (!alreadyExists) {
            const newExpense = await createExpense({
              project_id: originalExpense.project_id,
              description: `${originalExpense.description} (Recorrência Semanal)`,
              amount: originalExpense.value,
              category: originalExpense.category,
              expense_date: date,
              user_id: originalExpense.user_id,
              billing_type: 'unica', // As recorrências são marcadas como únicas
              is_recurring: false,
              recurring_day_of_week: null,
              recurring_end_date: null,
              original_expense_id: originalExpense.id,
              notes: originalExpense.notes
            });
            createdExpenses.push(newExpense);
          }
        }
        break;

      case 'mensal':
        // Para despesas mensais, criar uma despesa no mesmo dia do mês
        const originalDate = new Date(originalExpense.expense_date);
        const monthlyDate = new Date(year, month - 1, originalDate.getDate());
        
        // Ajustar se o dia não existir no mês (ex: 31 de fevereiro)
        if (monthlyDate.getMonth() !== month - 1) {
          monthlyDate.setDate(0); // Último dia do mês anterior
        }
        
        const monthlyDateStr = monthlyDate.toISOString().split('T')[0];
        
        const existingMonthly = await getExpenses();
        const monthlyExists = existingMonthly.some(expense => 
          expense.original_expense_id === originalExpense.id && 
          expense.expense_date === monthlyDateStr
        );

        if (!monthlyExists) {
          const newMonthlyExpense = await createExpense({
            project_id: originalExpense.project_id,
            description: `${originalExpense.description} (Recorrência Mensal)`,
            amount: originalExpense.value,
            category: originalExpense.category,
            expense_date: monthlyDateStr,
            user_id: originalExpense.user_id,
            billing_type: 'unica',
            is_recurring: false,
            recurring_day_of_week: null,
            recurring_end_date: null,
            original_expense_id: originalExpense.id,
            notes: originalExpense.notes
          });
          createdExpenses.push(newMonthlyExpense);
        }
        break;

      case 'anual':
        // Para despesas anuais, criar uma despesa no mesmo mês e dia
        const originalAnnualDate = new Date(originalExpense.expense_date);
        const annualDate = new Date(year, originalAnnualDate.getMonth(), originalAnnualDate.getDate());
        const annualDateStr = annualDate.toISOString().split('T')[0];
        
        const existingAnnual = await getExpenses();
        const annualExists = existingAnnual.some(expense => 
          expense.original_expense_id === originalExpense.id && 
          expense.expense_date === annualDateStr
        );

        if (!annualExists) {
          const newAnnualExpense = await createExpense({
            project_id: originalExpense.project_id,
            description: `${originalExpense.description} (Recorrência Anual)`,
            amount: originalExpense.value,
            category: originalExpense.category,
            expense_date: annualDateStr,
            user_id: originalExpense.user_id,
            billing_type: 'unica',
            is_recurring: false,
            recurring_day_of_week: null,
            recurring_end_date: null,
            original_expense_id: originalExpense.id,
            notes: originalExpense.notes
          });
          createdExpenses.push(newAnnualExpense);
        }
        break;
    }
  } catch (error) {
    console.error('Erro ao gerar despesas recorrentes:', error);
  }

  return createdExpenses;
}

/**
 * Processa todas as despesas recorrentes para um período específico
 * @param year - Ano
 * @param month - Mês (1-12)
 * @returns Número total de despesas criadas
 */
export async function processRecurringExpensesForPeriod(
  year: number,
  month: number
): Promise<number> {
  try {
    const allExpenses = await getExpenses();
    const recurringExpenses = allExpenses.filter(expense => 
      expense.is_recurring && expense.original_expense_id === null
    );

    let totalCreated = 0;

    for (const expense of recurringExpenses) {
      const created = await generateRecurringExpenses(expense, year, month);
      totalCreated += created.length;
    }

    return totalCreated;
  } catch (error) {
    console.error('Erro ao processar despesas recorrentes:', error);
    return 0;
  }
}

/**
 * Obtém todas as despesas (originais + recorrentes) para um período
 * @param year - Ano
 * @param month - Mês (1-12)
 * @returns Array de despesas
 */
export async function getExpensesForPeriod(
  year: number,
  month: number
): Promise<Expense[]> {
  // Primeiro, processar despesas recorrentes para o período
  await processRecurringExpensesForPeriod(year, month);
  
  // Depois, buscar todas as despesas
  const allExpenses = await getExpenses();
  
  // Filtrar despesas do período específico
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return allExpenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= startDate && expenseDate <= endDate;
  });
}