
import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Banknote, Receipt, Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface FinancialSummaryProps {
  totalIncome: number;
  totalExpenses: number;
  totalReceivable?: number;
  previousIncome?: number;
  previousExpenses?: number;
  previousReceivable?: number;
  period?: string;
  className?: string;
  onCardClick?: (type: 'income' | 'expenses' | 'balance' | 'receivable') => void;
}

const FinancialSummary: React.FC<FinancialSummaryProps> = ({
  totalIncome,
  totalExpenses,
  totalReceivable = 0,
  previousIncome,
  previousExpenses,
  previousReceivable,
  period = '',
  className = '',
  onCardClick
}) => {
  const isMobile = useIsMobile();
  
  const balance = totalIncome - totalExpenses;
  const previousBalance = previousIncome && previousExpenses 
    ? previousIncome - previousExpenses 
    : undefined;
  
  const getPercentChange = (current: number, previous: number | undefined) => {
    if (!previous) return null;
    return ((current - previous) / previous) * 100;
  };
  
  const incomeChange = getPercentChange(totalIncome, previousIncome);
  const expensesChange = getPercentChange(totalExpenses, previousExpenses);
  const balanceChange = getPercentChange(balance, previousBalance);
  const receivableChange = getPercentChange(totalReceivable, previousReceivable);
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };
  
  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 ${className}`}
    >
      <motion.div variants={item}>
        <Card 
          className={`bg-white dark:bg-[#1D2530] hover:shadow-md transition-shadow ${onCardClick ? 'cursor-pointer' : ''}`} 
          onClick={() => onCardClick && onCardClick('income')}
        >
          <CardHeader className="pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-base md:text-lg flex items-center">
              <Banknote className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2 text-green-500" />
              Faturamento
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {period ? `Total para ${period}` : 'Total de entradas'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <p className="text-xl md:text-2xl font-bold text-green-600">{totalIncome.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}</p>
            
            {incomeChange !== null && (
              <p className={`text-xs md:text-sm flex items-center ${
                incomeChange > 0 ? 'text-green-600' : incomeChange < 0 ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {incomeChange > 0 ? (
                  <TrendingUp className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                ) : incomeChange < 0 ? (
                  <TrendingDown className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                ) : null}
                {incomeChange > 0 ? '+' : ''}{incomeChange.toFixed(1)}%
                {!isMobile && " em relação ao período anterior"}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
      
      <motion.div variants={item}>
        <Card 
          className={`bg-white dark:bg-[#1D2530] hover:shadow-md transition-shadow ${onCardClick ? 'cursor-pointer' : ''}`} 
          onClick={() => onCardClick && onCardClick('expenses')}
        >
          <CardHeader className="pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-base md:text-lg flex items-center">
              <Receipt className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2 text-red-500" />
              Despesas
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {period ? `Total para ${period}` : 'Total de saídas'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <p className="text-xl md:text-2xl font-bold text-red-600">{totalExpenses.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}</p>
            
            {expensesChange !== null && (
              <p className={`text-xs md:text-sm flex items-center ${
                expensesChange < 0 ? 'text-green-600' : expensesChange > 0 ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {expensesChange > 0 ? (
                  <TrendingUp className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                ) : expensesChange < 0 ? (
                  <TrendingDown className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                ) : null}
                {expensesChange > 0 ? '+' : ''}{expensesChange.toFixed(1)}%
                {!isMobile && " em relação ao período anterior"}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
      
      <motion.div variants={item}>
        <Card 
          className={`bg-white dark:bg-[#1D2530] hover:shadow-md transition-shadow ${onCardClick ? 'cursor-pointer' : ''}`} 
          onClick={() => onCardClick && onCardClick('receivable')}
        >
          <CardHeader className="pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-base md:text-lg flex items-center">
              <Clock className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2 text-orange-500" />
              A Receber
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {period ? `Pendente para ${period}` : 'Valores pendentes'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <p className="text-xl md:text-2xl font-bold text-orange-600">{totalReceivable.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}</p>
            
            {receivableChange !== null && (
              <p className={`text-xs md:text-sm flex items-center ${
                receivableChange < 0 ? 'text-green-600' : receivableChange > 0 ? 'text-orange-600' : 'text-muted-foreground'
              }`}>
                {receivableChange > 0 ? (
                  <TrendingUp className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                ) : receivableChange < 0 ? (
                  <TrendingDown className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                ) : null}
                {receivableChange > 0 ? '+' : ''}{receivableChange.toFixed(1)}%
                {!isMobile && " em relação ao período anterior"}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
      
      <motion.div variants={item} className="sm:col-span-2 lg:col-span-1">
        <Card 
          className={`bg-white dark:bg-[#1D2530] hover:shadow-md transition-shadow ${onCardClick ? 'cursor-pointer' : ''}`}
          onClick={() => onCardClick && onCardClick('balance')}
        >
          <CardHeader className="pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-base md:text-lg flex items-center">
              <DollarSign className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2 text-blue-500" />
              Lucro
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {period ? `Balanço para ${period}` : 'Faturamento - Despesas'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            <p className={`text-xl md:text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {balance.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </p>
            
            {balanceChange !== null && (
              <p className={`text-xs md:text-sm flex items-center ${
                balanceChange > 0 ? 'text-green-600' : balanceChange < 0 ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {balanceChange > 0 ? (
                  <TrendingUp className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                ) : balanceChange < 0 ? (
                  <TrendingDown className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                ) : null}
                {balanceChange > 0 ? '+' : ''}{balanceChange.toFixed(1)}%
                {!isMobile && " em relação ao período anterior"}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default FinancialSummary;
