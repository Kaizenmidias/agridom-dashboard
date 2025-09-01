import React, { useState } from 'react';
import { addDays, format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FinancialSummary from '@/components/finance/FinancialSummary';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DashboardWithFilter: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
  });

  // Dados dos projetos simulados para calcular valores a receber
  const projetos = [
    { valor: 15000, valorPago: 10000 }, // 5000 a receber
    { valor: 25000, valorPago: 25000 }, // 0 a receber
    { valor: 8500, valorPago: 3000 }    // 5500 a receber
  ];

  // Dados financeiros simulados
  const currentMonthData = {
    revenue: 78500,
    expenses: 44200,
    profit: 34300,
    receivable: projetos.reduce((acc, projeto) => acc + (projeto.valor - projeto.valorPago), 0)
  };

  const previousMonthData = {
    revenue: 68800,
    expenses: 39900,
    profit: 28900,
    receivable: 8000
  };

  // Dados do gráfico por período - simulando dados diferentes para cada mês
  const getChartDataForPeriod = (period: string) => {
    if (period === 'year') {
      return [
        { name: 'Jan', value: 48500 },
        { name: 'Fev', value: 52200 },
        { name: 'Mar', value: 58800 },
        { name: 'Abr', value: 65500 },
        { name: 'Mai', value: 72200 },
        { name: 'Jun', value: 68800 },
        { name: 'Jul', value: 78500 },
        { name: 'Ago', value: 84800 },
        { name: 'Set', value: 76200 },
        { name: 'Out', value: 71200 },
        { name: 'Nov', value: 68500 },
        { name: 'Dez', value: 82200 }
      ];
    } else {
      // Dados semanais para o mês selecionado
      const [year, month] = period.split('-');
      const monthName = format(new Date(parseInt(year), parseInt(month)), 'MMMM', { locale: pt });
      return [
        { name: `${monthName} S1`, value: Math.floor(Math.random() * 20000) + 15000 },
        { name: `${monthName} S2`, value: Math.floor(Math.random() * 20000) + 15000 },
        { name: `${monthName} S3`, value: Math.floor(Math.random() * 20000) + 15000 },
        { name: `${monthName} S4`, value: Math.floor(Math.random() * 20000) + 15000 }
      ];
    }
  };

  const chartData = getChartDataForPeriod(selectedPeriod);

  const formatPeriod = () => {
    if (selectedPeriod === 'year') {
      return `ano de ${new Date().getFullYear()}`;
    }
    const [year, month] = selectedPeriod.split('-');
    return format(new Date(parseInt(year), parseInt(month)), 'MMMM yyyy', { locale: pt });
  };

  const getPeriodOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    
    // Adicionar opção "Este ano"
    options.push({ value: 'year', label: 'Este ano' });
    
    // Adicionar meses do ano atual
    for (let month = 0; month < 12; month++) {
      const date = new Date(currentYear, month);
      const value = `${currentYear}-${month}`;
      const label = format(date, 'MMMM yyyy', { locale: pt });
      options.push({ value, label });
    }
    
    return options;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <p className="text-muted-foreground">
            Visão geral das métricas do sistema
          </p>
        </div>
        
        <div className="w-full md:w-auto">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full md:w-auto min-w-[200px]">
              <SelectValue placeholder="Selecionar período" />
            </SelectTrigger>
            <SelectContent>
              {getPeriodOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo Financeiro */}
      <FinancialSummary
        totalIncome={currentMonthData.revenue}
        totalExpenses={currentMonthData.expenses}
        totalReceivable={currentMonthData.receivable}
        previousIncome={previousMonthData.revenue}
        previousExpenses={previousMonthData.expenses}
        previousReceivable={previousMonthData.receivable}
        period={formatPeriod()}
      />

      {/* Gráfico de Relatório */}
      <Card>
        <CardHeader>
          <CardTitle>Relatório</CardTitle>
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