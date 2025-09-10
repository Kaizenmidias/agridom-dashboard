
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Sprout, 
  CloudRain, 
  Sun,
  Droplet,
  Wind,
  ArrowRight,
  Calendar,
  Wallet,
  Trash2,
  Plus,
  X,
  Check,
  Edit
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { EditableField } from './ui/editable-field';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import PageHeader from './layout/PageHeader';
import { dashboardAPI, DashboardStats } from '../api/supabase-client';
import { useAuth } from '@/contexts/AuthContext';

// Dados fictícios removidos - agora usando apenas dados reais da API

const Dashboard = () => {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  
  // State for editable content
  const [title, setTitle] = useState('Dashboard de Projetos');
  const [description, setDescription] = useState('Visão geral dos seus projetos e despesas');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  });
  
  // Dashboard stats from backend
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Stats cards (will be populated from backend data)
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);

  const [activeProjects, setActiveProjects] = useState(0);
  const [completedProjects, setCompletedProjects] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [alertsCount, setAlertsCount] = useState(3);
  
  // Tasks and alerts
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  // Agricultural metrics
  const [cultivatedArea, setCultivatedArea] = useState(0);
  const [parcelsCount, setParcelsCount] = useState(0);
  const [averageYield, setAverageYield] = useState(0);
  const [yieldGrowth, setYieldGrowth] = useState(0);
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  
  // New alert dialog
  const [showAddAlertDialog, setShowAddAlertDialog] = useState(false);
  const [newAlert, setNewAlert] = useState({
    type: 'Cyclone',
    region: '',
    startDate: '',
    endDate: '',
    severity: 'modérée',
    description: ''
  });
  
  // Task editing state
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [editedTaskTitle, setEditedTaskTitle] = useState('');
  
  // Load dashboard data from backend
  useEffect(() => {
    // Don't load data if not authenticated or still checking auth
    if (authLoading || !isAuthenticated) {
      return;
    }
    
    let isMounted = true;
    let hasLoaded = false;
    
    const loadDashboardData = async () => {
      // Evitar múltiplas execuções simultâneas
      if (hasLoaded || !isMounted) return;
      hasLoaded = true;
      
      // Verificar se o usuário está autenticado antes de carregar dados
      if (!isAuthenticated || !user) {
        console.warn('Tentativa de carregar dashboard sem autenticação válida');
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      
      try {
        if (isMounted) {
          setLoading(true);
        }
        
        const result = await dashboardAPI.getDashboardStats();
        if (result.error) {
          throw new Error(result.error);
        }
        const stats = result.data;
        
        if (isMounted) {
          setDashboardStats(stats);
          
          // Update state with real data - ensure proper number conversion with safe access
          const revenue = parseFloat(String(stats?.projects?.total_paid_value || 0));
          const expenses = parseFloat(String(stats?.current_period?.expenses || 0));
          
          setMonthlyRevenue(revenue);
          setActiveProjects(Number(stats?.projects?.active_projects) || 0);
          setCompletedProjects(Number(stats?.projects?.completed_projects) || 0);
          setTotalExpenses(expenses);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        if (isMounted) {
          // Se for erro de token, não mostrar toast de erro (será tratado pela autenticação)
          if (error?.message?.includes('Token') || error?.message?.includes('token')) {
            console.warn('Erro de token ao carregar dashboard, será tratado pela autenticação');
          } else {
            toast.error('Erro ao carregar dados do dashboard');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    // Usar timeout para evitar execução imediata e throttling
     const timeoutId = setTimeout(loadDashboardData, 200);
     
     return () => {
       isMounted = false;
       clearTimeout(timeoutId);
     };
   }, [isAuthenticated, authLoading]);
  
  // Handle changes
  const handleTitleChange = (value: string | number) => {
    setTitle(String(value));
    toast.success('Titre mis à jour');
  };
  
  const handleDescriptionChange = (value: string | number) => {
    setDescription(String(value));
    toast.success('Description mise à jour');
  };
  
  const handleMonthChange = (value: string | number) => {
    setCurrentMonth(String(value));
    toast.success('Mois mis à jour');
  };
  
  // Stat card updates
  const handleRevenueChange = (value: string | number) => {
    setMonthlyRevenue(Number(value));
    toast.success('Receita mensal atualizada');
  };
  

  
  const handleAreaChange = (value: string | number) => {
    setCultivatedArea(Number(value));
    toast.success('Superfície cultivada atualizada');
  };
  
  const handleParcelsCountChange = (value: string | number) => {
    setParcelsCount(Number(value));
    toast.success('Nombre de parcelles mis à jour');
  };
  
  const handleYieldChange = (value: string | number) => {
    setAverageYield(Number(value));
    toast.success('Rendement moyen mis à jour');
  };
  
  const handleYieldGrowthChange = (value: string | number) => {
    setYieldGrowth(Number(value));
    toast.success('Croissance du rendement mise à jour');
  };
  
  // Task management
  const handleEditTask = (taskId: number) => {
    const task = upcomingTasks.find(t => t.id === taskId);
    if (task) {
      setEditingTask(taskId);
      setEditedTaskTitle(task.title);
    }
  };
  
  const handleSaveTask = (taskId: number) => {
    if (editedTaskTitle.trim() === '') return;
    
    setUpcomingTasks(upcomingTasks.map(task => 
      task.id === taskId ? { ...task, title: editedTaskTitle } : task
    ));
    setEditingTask(null);
    toast.success('Tâche mise à jour');
  };
  
  const handleDeleteTask = (taskId: number) => {
    setUpcomingTasks(upcomingTasks.filter(task => task.id !== taskId));
    toast.success('Tâche supprimée');
  };
  
  // Alert management
  const handleEditAlert = (id: number, message: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === id ? { ...alert, message } : alert
    ));
    toast.success('Alerte mise à jour');
  };
  
  const handleDeleteAlert = (id: number) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
    setAlertsCount(prev => prev - 1);
    toast.success('Alerte supprimée');
  };
  
  // Weather alert management
  const handleDeleteWeatherAlert = (id: number) => {
    setWeatherAlerts(weatherAlerts.filter(alert => alert.id !== id));
    toast.success('Alerte météorologique supprimée');
  };
  
  const handleAddWeatherAlert = () => {
    // Validation
    if (!newAlert.region || !newAlert.startDate || !newAlert.endDate || !newAlert.description) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    const newId = Math.max(...weatherAlerts.map(a => a.id), 0) + 1;
    const alertToAdd = {
      id: newId,
      ...newAlert
    };
    
    setWeatherAlerts([...weatherAlerts, alertToAdd]);
    setShowAddAlertDialog(false);
    setNewAlert({
      type: 'Cyclone',
      region: '',
      startDate: '',
      endDate: '',
      severity: 'modérée',
      description: ''
    });
    
    toast.success('Nouvelle alerte météorologique ajoutée');
  };
  
  // Add transaction handler (placeholder for future implementation)
  const handleAddTransaction = () => {
    toast.info('Redirection vers la page de finances');
    // In a real app, this would navigate to the finance page
  };
  
  return (
    <div className="p-6 space-y-6 animate-enter">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            <EditableField
              value={title}
              onSave={handleTitleChange}
              className="inline-block"
              showEditIcon={true}
            />
          </h1>
          <p className="text-muted-foreground">
            <EditableField
              value={description}
              onSave={handleDescriptionChange}
              className="inline-block"
              showEditIcon={true}
            />
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button className="px-4 py-2 text-sm text-agri-primary font-medium bg-agri-primary/10 rounded-lg hover:bg-agri-primary/20 transition-colors">
            <Calendar className="h-4 w-4 inline mr-2" />
            <EditableField
              value={currentMonth}
              onSave={handleMonthChange}
              className="inline-block"
            />
          </button>
          <button 
            className="px-4 py-2 text-sm bg-agri-primary text-white rounded-lg hover:bg-agri-primary-dark transition-colors"
            onClick={handleAddTransaction}
          >
            <Wallet className="h-4 w-4 inline mr-2" />
            Ajouter une transaction
          </button>
        </div>
      </header>

      {/* Quick Stats Row - Dados reais dos projetos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="stat-card card-hover">
          <p className="stat-label">Faturamento Total</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="stat-value">
              {loading ? 'Carregando...' : Number(monthlyRevenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <span className="text-green-600 text-sm font-medium">
              Total acumulado
            </span>
          </div>
        </div>
        
        <div className="stat-card card-hover">
          <p className="stat-label">Projetos Ativos</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="stat-value">
              {loading ? 'Carregando...' : activeProjects}
            </p>
            <span className="text-blue-600 text-sm font-medium">
              Em andamento
            </span>
          </div>
        </div>
        
        <div className="stat-card card-hover">
          <p className="stat-label">Projetos Concluídos</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="stat-value">
              {loading ? 'Carregando...' : completedProjects}
            </p>
            <span className="text-green-600 text-sm font-medium flex items-center">
              <Check className="h-4 w-4 mr-1" /> Finalizados
            </span>
          </div>
        </div>
        
        <div className="stat-card card-hover">
          <p className="stat-label">Total de Despesas</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="stat-value">
              {loading ? 'Carregando...' : Number(totalExpenses || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <span className="text-red-600 text-sm font-medium flex items-center">
              <Wallet className="h-4 w-4 mr-1" /> Gastos
            </span>
          </div>
        </div>
        
        <div className="stat-card card-hover">
          <p className="stat-label">A Receber</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="stat-value">
              {loading ? 'Carregando...' : Number(dashboardStats?.current_receivable || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <span className="text-orange-600 text-sm font-medium">
              Pendente
            </span>
          </div>
        </div>
        
        <div className="stat-card card-hover">
          <p className="stat-label">Lucro</p>
          <div className="flex items-baseline justify-between mt-2">
            <p className="stat-value">
              {loading ? 'Carregando...' : (Number(monthlyRevenue || 0) - Number(totalExpenses || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <span className={`text-sm font-medium ${
              (Number(monthlyRevenue || 0) - Number(totalExpenses || 0)) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(Number(monthlyRevenue || 0) - Number(totalExpenses || 0)) >= 0 ? 'Positivo' : 'Negativo'}
            </span>
          </div>
        </div>
      </div>

      {/* Weather alerts section */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Alertes Météorologiques</h2>
          <Button 
            onClick={() => setShowAddAlertDialog(true)}
            className="bg-agri-primary hover:bg-agri-primary-dark"
          >
            <Plus size={16} className="mr-2" /> Ajouter une alerte
          </Button>
        </div>
        <p className="text-muted-foreground mb-6">
          Acompanhe os alertas meteorológicos que impactam a agricultura na Guadalupe
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Região</th>
        <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-left">Sévérité</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {weatherAlerts.map(alert => (
                <tr key={alert.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 flex items-center">
                    {alert.type === 'Cyclone' ? (
                      <span className="flex items-center text-red-500">
                        <AlertTriangle size={16} className="mr-1" /> {alert.type}
                      </span>
                    ) : alert.type === 'Pluie' ? (
                      <span className="flex items-center text-blue-500">
                        <CloudRain size={16} className="mr-1" /> {alert.type}
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Wind size={16} className="mr-1" /> {alert.type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <EditableField
                      value={alert.region}
                      onSave={(value) => {
                        setWeatherAlerts(weatherAlerts.map(a => 
                          a.id === alert.id ? { ...a, region: String(value) } : a
                        ));
                        toast.success('Região atualizada');
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div>
                        <span className="text-xs text-muted-foreground">Início:</span>
                        <EditableField
                          value={alert.startDate}
                          type="date"
                          onSave={(value) => {
                            setWeatherAlerts(weatherAlerts.map(a => 
                              a.id === alert.id ? { ...a, startDate: String(value) } : a
                            ));
                            toast.success('Data de início atualizada');
                          }}
                        />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Fim:</span>
                        <EditableField
                          value={alert.endDate}
                          type="date"
                          onSave={(value) => {
                            setWeatherAlerts(weatherAlerts.map(a => 
                              a.id === alert.id ? { ...a, endDate: String(value) } : a
                            ));
                            toast.success('Data de fim atualizada');
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      alert.severity === 'critique' 
                        ? 'bg-red-100 text-red-800' 
                        : alert.severity === 'modérée'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                    }`}>
                      <EditableField
                        value={alert.severity}
                        onSave={(value) => {
                          setWeatherAlerts(weatherAlerts.map(a => 
                            a.id === alert.id ? { ...a, severity: String(value) } : a
                          ));
                          toast.success('Sévérité mise à jour');
                        }}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <EditableField
                      value={alert.description}
                      onSave={(value) => {
                        setWeatherAlerts(weatherAlerts.map(a => 
                          a.id === alert.id ? { ...a, description: String(value) } : a
                        ));
                        toast.success('Description mise à jour');
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteWeatherAlert(alert.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-100"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
              {weatherAlerts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">
                    Aucune alerte météorologique disponible
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart - Dados reais de faturamento */}
        <div className="dashboard-card col-span-full lg:col-span-2 card-hover">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Evolução do Faturamento</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Período:</span>
              <EditableField
                value={currentMonth}
                type="text"
                onSave={handleMonthChange}
                className="text-sm font-medium"
              />
            </div>
          </div>
          <div className="h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Carregando dados...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dashboardStats?.revenue_by_month.map(item => ({
                    month: new Date(item.month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                    revenue: item.revenue
                  })) || []}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#4CAF50" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                  <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']} />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#4CAF50" 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                    activeDot={{ r: 8 }} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expenses by Category Chart */}
        <div className="dashboard-card card-hover">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Despesas por Categoria</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Total:</span>
              <span className="text-sm font-medium">
                R$ {dashboardStats?.expenses_by_category.reduce((sum, item) => sum + item.total_amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
              </span>
            </div>
          </div>
          <div className="h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Carregando dados...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dashboardStats?.expenses_by_category.map(item => ({
                    category: item.category || 'Sem categoria',
                    total: item.total_amount
                  })) || []}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                  <YAxis 
                    dataKey="category" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={80} 
                  />
                  <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Total']} />
                  <Bar 
                    dataKey="total" 
                    fill="#FF9800" 
                    radius={[0, 4, 4, 0]} 
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="dashboard-card card-hover">
          <h3 className="font-semibold mb-4">Projetos Recentes</h3>
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-gray-500">Carregando projetos...</p>
              </div>
            ) : dashboardStats?.recent_projects && dashboardStats.recent_projects.length > 0 ? (
              dashboardStats.recent_projects.map((project, index) => {
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'ativo': return 'bg-green-500';
                    case 'concluido': return 'bg-blue-500';
                    case 'pausado': return 'bg-yellow-500';
                    default: return 'bg-gray-500';
                  }
                };
                
                const getStatusText = (status: string) => {
                  switch (status) {
                    case 'ativo': return 'Ativo';
                    case 'concluido': return 'Concluído';
                    case 'pausado': return 'Pausado';
                    default: return 'Indefinido';
                  }
                };
                
                const getProgressPercentage = (status: string) => {
                  switch (status) {
                    case 'ativo': return 50;
                    case 'concluido': return 100;
                    case 'pausado': return 25;
                    default: return 0;
                  }
                };
                
                const progress = getProgressPercentage(project.status);
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{project.name}</p>
                      <p className="text-xs text-gray-600">{getStatusText(project.status)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Valor: R$ {Number(project.project_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{progress}%</p>
                      <div className="w-16 h-2 bg-gray-200 rounded-full mt-1">
                        <div 
                          className={`h-full rounded-full ${getStatusColor(project.status)}`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum projeto encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Tasks - Adapté au contexte agricole guadeloupéen */}
        <div className="dashboard-card card-hover">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Tâches à venir</h3>
            <button className="text-xs text-agri-primary hover:underline">Voir tout</button>
          </div>
          
          <div className="space-y-3">
            {upcomingTasks.map((task) => (
              <div 
                key={task.id} 
                className="flex items-center p-2 rounded-lg hover:bg-muted"
              >
                <div 
                  className={`w-2 h-2 rounded-full mr-3 ${
                    task.priority === 'high' 
                      ? 'bg-agri-danger' 
                      : task.priority === 'medium' 
                        ? 'bg-agri-warning' 
                        : 'bg-agri-success'
                  }`}
                />
                <div className="flex-1">
                  {editingTask === task.id ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={editedTaskTitle}
                        onChange={(e) => setEditedTaskTitle(e.target.value)}
                        className="border rounded px-2 py-1 text-sm w-full"
                        autoFocus
                      />
                      <button 
                        onClick={() => handleSaveTask(task.id)}
                        className="ml-2 p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setEditingTask(null)}
                        className="ml-1 p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">Échéance: {task.due}</p>
                    </>
                  )}
                </div>
                <div className="flex">
                  {editingTask !== task.id && (
                    <>
                      <button 
                        className="p-1.5 hover:bg-muted rounded" 
                        onClick={() => handleEditTask(task.id)}
                      >
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-muted rounded text-red-500" 
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {upcomingTasks.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Aucune tâche à venir</p>
            )}
          </div>
        </div>
        
        {/* Alertas - Adaptado à agricultura na Guadalupe */}
        <div className="dashboard-card card-hover">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Alertes</h3>
            <button className="text-xs text-agri-primary hover:underline">Gérer les alertes</button>
          </div>
          
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`p-3 rounded-lg ${
                  alert.type === 'danger' 
                    ? 'bg-agri-danger/10 border-l-4 border-agri-danger' 
                    : alert.type === 'warning' 
                      ? 'bg-agri-warning/10 border-l-4 border-agri-warning' 
                      : 'bg-agri-info/10 border-l-4 border-agri-info'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start flex-1">
                    <AlertTriangle className={`h-5 w-5 mr-2 ${
                      alert.type === 'danger' 
                        ? 'text-agri-danger' 
                        : alert.type === 'warning' 
                          ? 'text-agri-warning' 
                          : 'text-agri-info'
                    }`} />
                    <EditableField 
                      value={alert.message} 
                      onSave={(value) => handleEditAlert(alert.id, String(value))}
                      className="text-sm"
                    />
                  </div>
                  <button 
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Aucune alerte active</p>
            )}
          </div>
        </div>
      </div>

      {/* Add Weather Alert Dialog */}
      <Dialog open={showAddAlertDialog} onOpenChange={setShowAddAlertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une alerte météorologique</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="alertType" className="text-right">
                Type
              </Label>
              <select
                id="alertType"
                value={newAlert.type}
                onChange={(e) => setNewAlert({...newAlert, type: e.target.value})}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="Cyclone">Cyclone</option>
                <option value="Pluie">Pluie</option>
                <option value="Sécheresse">Sécheresse</option>
                <option value="Vent">Vent</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="region" className="text-right">
                Região
              </Label>
              <Input
                id="region"
                value={newAlert.region}
                onChange={(e) => setNewAlert({...newAlert, region: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-right">
                Data de início
              </Label>
              <Input
                id="startDate"
                type="date"
                value={newAlert.startDate}
                onChange={(e) => setNewAlert({...newAlert, startDate: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endDate" className="text-right">
                Data de fim
              </Label>
              <Input
                id="endDate"
                type="date"
                value={newAlert.endDate}
                onChange={(e) => setNewAlert({...newAlert, endDate: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="severity" className="text-right">
                Sévérité
              </Label>
              <select
                id="severity"
                value={newAlert.severity}
                onChange={(e) => setNewAlert({...newAlert, severity: e.target.value})}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="faible">Faible</option>
                <option value="modérée">Modérée</option>
                <option value="critique">Critique</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                value={newAlert.description}
                onChange={(e) => setNewAlert({...newAlert, description: e.target.value})}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAlertDialog(false)}>Annuler</Button>
            <Button onClick={handleAddWeatherAlert}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
