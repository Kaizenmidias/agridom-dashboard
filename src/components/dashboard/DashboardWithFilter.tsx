import React, { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { addDays, format, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import FinancialSummary from '@/components/finance/FinancialSummary';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DashboardWithFilter: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Dados financeiros simulados
  const currentMonthData = {
    revenue: 78500,
    expenses: 44200,
    profit: 34300
  };

  const previousMonthData = {
    revenue: 68800,
    expenses: 39900,
    profit: 28900
  };

  // Dados do gráfico por categoria
  const chartData = [
    { name: 'E-commerce', value: 28500, color: '#4CAF50' },
    { name: 'Landing Pages', value: 15200, color: '#2196F3' },
    { name: 'Sistemas Web', value: 22000, color: '#FF9800' },
    { name: 'Marketing Digital', value: 8800, color: '#9C27B0' },
    { name: 'Aplicativos', value: 4000, color: '#F44336' }
  ];

  const formatPeriod = () => {
    if (!dateRange?.from || !dateRange?.to) return 'o período selecionado';
    
    const isSameMonth = dateRange.from.getMonth() === dateRange.to.getMonth() && 
                       dateRange.from.getFullYear() === dateRange.to.getFullYear();
    
    if (isSameMonth) {
      return format(dateRange.from, 'MMMM yyyy', { locale: pt });
    }
    
    return `${format(dateRange.from, 'dd/MM/yyyy', { locale: pt })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: pt })}`;
  };

  const presets = [
    { label: "Este mês", days: 0 },
    { label: "Últimos 30 dias", days: 30 },
    { label: "Últimos 90 dias", days: 90 },
    { label: "Este ano", days: 365 }
  ];

  const customPresets = presets.map(preset => ({
    label: preset.label,
    days: preset.days
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral das métricas da Kaizen Web Design
          </p>
        </div>
        
        <div className="w-full md:w-auto">
          <DatePickerWithRange
            date={dateRange}
            setDate={setDateRange}
            placeholderText="Selecionar período"
            presets={customPresets}
            className="w-full md:w-auto"
          />
        </div>
      </div>

      {/* Resumo Financeiro */}
      <FinancialSummary
        totalIncome={currentMonthData.revenue}
        totalExpenses={currentMonthData.expenses}
        previousIncome={previousMonthData.revenue}
        previousExpenses={previousMonthData.expenses}
        period={formatPeriod()}
      />

      {/* Gráfico de Faturamento por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento por Categoria de Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis 
                  tickFormatter={(value) => 
                    new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(value)
                  }
                />
                <Tooltip 
                  formatter={(value) => [
                    new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(Number(value)),
                    'Faturamento'
                  ]}
                />
                <Legend />
                <Bar 
                  dataKey="value" 
                  fill="#2563eb"
                  name="Faturamento"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
            <p className="text-xs text-muted-foreground">
              +3 desde o mês passado
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">
              +7 desde o mês passado
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.5%</div>
            <p className="text-xs text-muted-foreground">
              +1.2% desde o mês passado
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">
              +3% desde o mês passado
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardWithFilter;