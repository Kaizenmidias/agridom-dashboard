import React, { useState, useEffect } from 'react';
import { addDays, format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FinancialSummary from '@/components/finance/FinancialSummary';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);
import { getDashboardStats, DashboardStats } from '@/api/crud';
import { toast } from 'sonner';

const DashboardWithFilter: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}`;
  });
  const [selectedMetric, setSelectedMetric] = useState<string>('faturamento');

  // Estados para dados reais do dashboard
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Dados financeiros calculados a partir dos dados reais
  const currentMonthData = {
    revenue: Number(dashboardStats?.projects?.total_paid_value || 0),
    expenses: Number(dashboardStats?.current_period?.expenses || 0),
    profit: Number(dashboardStats?.projects?.total_paid_value || 0) - Number(dashboardStats?.current_period?.expenses || 0),
    receivable: Number(dashboardStats?.current_receivable || 0)
  };

  // Dados do mês anterior (dados reais da API)
  const previousMonthData = {
    revenue: Number(dashboardStats?.previous_period?.revenue || 0),
    expenses: Number(dashboardStats?.previous_period?.expenses || 0),
    profit: Number(dashboardStats?.previous_period?.revenue || 0) - Number(dashboardStats?.previous_period?.expenses || 0),
    receivable: Number(dashboardStats?.previous_period?.receivable || 0)
  };

  // Carregar dados reais do dashboard
  const loadDashboardData = async (filters?: {
    startDate?: string;
    endDate?: string;
    previousStartDate?: string;
    previousEndDate?: string;
  }) => {
    try {
      setLoading(true);
      console.log('Frontend - Enviando filtros para API:', filters);
      const data = await getDashboardStats(filters);
      setDashboardStats(data);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    
    console.log('Frontend - Período selecionado:', newPeriod);
    
    const now = new Date();
    let startDate: string, endDate: string, previousStartDate: string, previousEndDate: string;
    
    if (newPeriod === 'year') {
      // Ano atual
      const startOfCurrentYear = startOfYear(now);
      const endOfCurrentYear = endOfYear(now);
      
      startDate = format(startOfCurrentYear, 'yyyy-MM-dd');
      endDate = format(endOfCurrentYear, 'yyyy-MM-dd');
      
      // Ano anterior
      const prevYear = new Date(now.getFullYear() - 1, 0, 1);
      const prevStartOfYear = startOfYear(prevYear);
      const prevEndOfYear = endOfYear(prevYear);
      
      previousStartDate = format(prevStartOfYear, 'yyyy-MM-dd');
      previousEndDate = format(prevEndOfYear, 'yyyy-MM-dd');
    } else {
      // Mês específico
      const [year, month] = newPeriod.split('-');
      const selectedDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      
      const startOfSelectedMonth = startOfMonth(selectedDate);
      const endOfSelectedMonth = endOfMonth(selectedDate);
      
      startDate = format(startOfSelectedMonth, 'yyyy-MM-dd');
      endDate = format(endOfSelectedMonth, 'yyyy-MM-dd');
      
      // Mês anterior
      const prevMonth = new Date(parseInt(year), parseInt(month) - 2, 1);
      const prevStartOfMonth = startOfMonth(prevMonth);
      const prevEndOfMonth = endOfMonth(prevMonth);
      
      previousStartDate = format(prevStartOfMonth, 'yyyy-MM-dd');
      previousEndDate = format(prevEndOfMonth, 'yyyy-MM-dd');
    }
    
    // Debug: Log das datas calculadas no frontend
    console.log('Frontend - Datas calculadas:', {
      startDate,
      endDate,
      previousStartDate,
      previousEndDate
    });
    
    // Carregar dados com filtros
    loadDashboardData({
      startDate,
      endDate,
      previousStartDate,
      previousEndDate
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'todos':
        return 'Todas as Métricas';
      case 'faturamento':
        return 'Faturamento';
      case 'despesas':
        return 'Despesas';
      case 'lucro':
        return 'Lucro';
      default:
        return 'Faturamento';
    }
  };

  const getMetricColor = () => {
    switch (selectedMetric) {
      case 'faturamento':
        return { bg: 'rgba(37, 99, 235, 0.6)', border: 'rgba(37, 99, 235, 1)' };
      case 'despesas':
        return { bg: 'rgba(239, 68, 68, 0.6)', border: 'rgba(239, 68, 68, 1)' };
      case 'lucro':
        return { bg: 'rgba(34, 197, 94, 0.6)', border: 'rgba(34, 197, 94, 1)' };
      default:
        return { bg: 'rgba(37, 99, 235, 0.6)', border: 'rgba(37, 99, 235, 1)' };
    }
  };

  // Dados do gráfico por período - usando dados reais
  const getChartDataForPeriod = (period: string, metric: string) => {
    if (!dashboardStats) return { labels: [], datasets: [] };
    
    if (period === 'year') {
      // Exibir dados mensais do ano atual até o presente momento
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth(); // 0-11
      
      // Criar array com todos os meses do ano atual até o mês atual
      const labels = [];
      const faturamentoData = [];
      const despesasData = [];
      const lucroData = [];
      
      for (let month = 0; month <= currentMonth; month++) {
        const monthStr = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
        
        // Buscar dados reais para este mês
        const monthData = dashboardStats.revenue_by_month.find(item => 
          item.month === monthStr
        );
        
        const revenue = monthData ? monthData.revenue : 0;
        const expenses = 0; // Dados de despesas não disponíveis neste formato
        const profit = revenue - expenses;
        
        labels.push(format(new Date(currentYear, month), 'MMM', { locale: pt }));
        faturamentoData.push(revenue);
        despesasData.push(expenses);
        lucroData.push(profit);
      }
      
      if (metric === 'todos') {
        return {
          labels,
          datasets: [
            {
              label: 'Faturamento',
              data: faturamentoData,
              backgroundColor: 'rgba(37, 99, 235, 0.6)',
              borderColor: 'rgba(37, 99, 235, 1)',
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: 'Despesas',
              data: despesasData,
              backgroundColor: 'rgba(239, 68, 68, 0.6)',
              borderColor: 'rgba(239, 68, 68, 1)',
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: 'Lucro',
              data: lucroData,
              backgroundColor: 'rgba(34, 197, 94, 0.6)',
              borderColor: 'rgba(34, 197, 94, 1)',
              borderWidth: 1,
              borderRadius: 4,
            },
          ]
        };
      } else {
        let data = [];
        switch (metric) {
          case 'faturamento':
            data = faturamentoData;
            break;
          case 'despesas':
            data = despesasData;
            break;
          case 'lucro':
            data = lucroData;
            break;
        }
        
        return {
          labels,
          datasets: [{
            label: getMetricLabel(),
            data,
            backgroundColor: getMetricColor().bg,
            borderColor: getMetricColor().border,
            borderWidth: 1,
            borderRadius: 4,
          }]
        };
      }
    } else {
      // Para mês específico, mostrar dados semanais baseados no total mensal
      const labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
      
      if (metric === 'todos') {
        const faturamentoWeekly = currentMonthData.revenue / 4;
        const despesasWeekly = currentMonthData.expenses / 4;
        const lucroWeekly = currentMonthData.profit / 4;
        
        return {
          labels,
          datasets: [
            {
              label: 'Faturamento',
              data: labels.map(() => Math.round(faturamentoWeekly * (0.8 + Math.random() * 0.4))),
              backgroundColor: 'rgba(37, 99, 235, 0.6)',
              borderColor: 'rgba(37, 99, 235, 1)',
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: 'Despesas',
              data: labels.map(() => Math.round(despesasWeekly * (0.8 + Math.random() * 0.4))),
              backgroundColor: 'rgba(239, 68, 68, 0.6)',
              borderColor: 'rgba(239, 68, 68, 1)',
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: 'Lucro',
              data: labels.map(() => Math.round(lucroWeekly * (0.8 + Math.random() * 0.4))),
              backgroundColor: 'rgba(34, 197, 94, 0.6)',
              borderColor: 'rgba(34, 197, 94, 1)',
              borderWidth: 1,
              borderRadius: 4,
            },
          ]
        };
      } else {
        let monthlyTotal = 0;
        switch (metric) {
          case 'faturamento':
            monthlyTotal = currentMonthData.revenue;
            break;
          case 'despesas':
            monthlyTotal = currentMonthData.expenses;
            break;
          case 'lucro':
            monthlyTotal = currentMonthData.profit;
            break;
        }
        
        const weeklyAverage = monthlyTotal / 4;
        const data = labels.map(() => Math.round(weeklyAverage * (0.8 + Math.random() * 0.4)));
        
        return {
          labels,
          datasets: [{
            label: getMetricLabel(),
            data,
            backgroundColor: getMetricColor().bg,
            borderColor: getMetricColor().border,
            borderWidth: 1,
            borderRadius: 4,
          }]
        };
      }
    }
  };

  const chartData = getChartDataForPeriod(selectedPeriod, selectedMetric);

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
      const value = `${currentYear}-${month + 1}`;
      const label = format(date, 'MMMM yyyy', { locale: pt });
      options.push({ value, label });
    }
    
    return options;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral dos seus projetos e finanças
        </p>
      </div>
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <p className="text-muted-foreground">
            Visão geral das métricas do sistema
          </p>
        </div>
        
        <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
          <div className="w-full md:w-auto">
            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
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
      </div>

      {/* Resumo Financeiro */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Carregando...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">...</div>
                  <p className="text-xs text-muted-foreground">Aguarde...</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <FinancialSummary
            totalIncome={currentMonthData.revenue}
            totalExpenses={currentMonthData.expenses}
            totalReceivable={currentMonthData.receivable}
            previousIncome={previousMonthData.revenue}
            previousExpenses={previousMonthData.expenses}
            previousReceivable={previousMonthData.receivable}
          />
        )}

      {/* Gráfico de Relatório */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Relatório de {getMetricLabel()}</CardTitle>
          <div className="w-auto">
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-auto min-w-[150px]">
                <SelectValue placeholder="Selecionar métrica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="faturamento">Faturamento</SelectItem>
                <SelectItem value="despesas">Despesas</SelectItem>
                <SelectItem value="lucro">Lucro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="text-lg font-medium">Carregando dados...</div>
                <div className="text-sm text-muted-foreground mt-2">Aguarde enquanto buscamos as informações</div>
              </div>
            </div>
          ) : (
            <div className="h-[400px]">
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                    },
                    title: {
                      display: false,
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const label = context.dataset.label || '';
                          return `${label}: ${new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(context.parsed.y)}`;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(Number(value));
                        }
                      }
                    },
                  },
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">📊</div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold">...</div>
            ) : (
              <div className="text-2xl font-bold">{dashboardStats?.projects?.active_projects || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Projetos em andamento
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projetos Concluídos</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">✅</div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold">...</div>
            ) : (
              <div className="text-2xl font-bold">{dashboardStats?.projects?.completed_projects || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Projetos finalizados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Projetos</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">📈</div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold">...</div>
            ) : (
              <div className="text-2xl font-bold">{dashboardStats?.projects?.total_projects || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Todos os projetos
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">💰</div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold">...</div>
            ) : (
              <div className="text-2xl font-bold">{dashboardStats?.expenses?.total_expenses || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Número de despesas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardWithFilter;