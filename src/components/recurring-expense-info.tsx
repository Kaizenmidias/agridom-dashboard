// Componente para exibir informações sobre despesas recorrentes

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Expense } from '@/types/database';
import { calculateMonthlyAmount, getWeekdayOccurrencesInMonth } from '@/utils/billing-calculations';
import { formatCurrency } from '@/lib/utils';
import { Calendar, Clock, Repeat } from 'lucide-react';

interface RecurringExpenseInfoProps {
  expense: Expense;
  currentYear?: number;
  currentMonth?: number;
}

const BILLING_TYPE_LABELS = {
  unica: 'Única',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual'
};

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'
];

export function RecurringExpenseInfo({ 
  expense, 
  currentYear = new Date().getFullYear(), 
  currentMonth = new Date().getMonth() + 1 
}: RecurringExpenseInfoProps) {
  const monthlyAmount = calculateMonthlyAmount(
    expense.value || expense.amount,
    expense.billing_type,
    expense.date,
    currentYear,
    currentMonth
  );

  const getBillingTypeColor = (type: string) => {
    switch (type) {
      case 'unica': return 'bg-gray-100 text-gray-800';
      case 'semanal': return 'bg-blue-100 text-blue-800';
      case 'mensal': return 'bg-green-100 text-green-800';
      case 'anual': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderRecurrenceDetails = () => {
    if (expense.billing_type === 'semanal' && expense.recurring_day_of_week !== null) {
      const weekdayName = WEEKDAY_NAMES[expense.recurring_day_of_week];
      const occurrences = getWeekdayOccurrencesInMonth(currentYear, currentMonth, expense.recurring_day_of_week);
      
      return (
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Toda {weekdayName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            <span>{occurrences}x este mês</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Valor mensal: {formatCurrency(monthlyAmount)}</span>
          </div>
        </div>
      );
    }

    if (expense.billing_type === 'anual') {
      return (
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Cobrança anual</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Valor mensal: {formatCurrency(monthlyAmount)}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{expense.description}</CardTitle>
          <Badge className={getBillingTypeColor(expense.billing_type)}>
            {BILLING_TYPE_LABELS[expense.billing_type]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Valor base:</span>
            <span className="font-semibold">{formatCurrency(expense.value || expense.amount)}</span>
          </div>
          
          {expense.billing_type !== 'unica' && expense.billing_type !== 'mensal' && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Impacto mensal:</span>
              <span className="font-semibold text-blue-600">{formatCurrency(monthlyAmount)}</span>
            </div>
          )}
          
          {renderRecurrenceDetails()}
          
          {expense.notes && (
            <div className="pt-2 border-t">
              <span className="text-sm text-gray-600">Observações:</span>
              <p className="text-sm mt-1">{expense.notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default RecurringExpenseInfo;