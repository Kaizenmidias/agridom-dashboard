import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, Plus, Calendar, DollarSign, User, TrendingUp, Clock, Search, Filter, CheckSquare, Loader2, Receipt, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NovoProjetoDialog } from '@/components/novo-projeto-dialog';
import { getProjects, deleteProject, updateProject, recordProjectPayment, getProjectFinancialHistory } from '@/api/crud';
import { Project } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { usePagination } from '@/hooks/use-pagination';

const projectValue = (value: number | null | undefined) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const calculateProjectStats = (projects: Project[]) => ({
  emAndamento: projects.filter((project) => project.status === 'active' || project.status === 'paused').length,
  finalizados: projects.filter((project) => project.status === 'completed').length,
  faturamentoTotal: projects.filter((project) => project.status !== 'cancelled')
    .reduce((total, project) => total + projectValue(project.financial_legacy_baseline) + projectValue(project.financial_event_total), 0),
  valorPendente: projects
    .filter((project) => project.status !== 'cancelled')
    .reduce((total, project) => total + Math.max(0, projectValue(project.project_value) - projectValue(project.paid_value)), 0),
});

const ProjetosPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [projetos, setProjetos] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para filtros e pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');
  
  // Estados para seleção múltipla
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [completingProjects, setCompletingProjects] = useState<string[]>([]);
  const [paymentProject, setPaymentProject] = useState<Project | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentKey, setPaymentKey] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [historyProject, setHistoryProject] = useState<Project | null>(null);
  const [financialHistory, setFinancialHistory] = useState<{ baseline: any | null; events: any[] }>({ baseline: null, events: [] });

  const todayDateOnly = () => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  };

  // Função para carregar projetos do backend
  const loadProjects = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const projects = await getProjects();
      // Garantir que projects seja sempre um array
      setProjetos(Array.isArray(projects) ? projects : []);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      // Em caso de erro, definir como array vazio
      setProjetos([]);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os projetos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user]); // Removido toast das dependências para evitar re-renders

  // Carregar projetos quando o componente montar
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]); // Simplificado para evitar loops de dependência

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id);
      // Se chegou até aqui, a exclusão foi bem-sucedida
      setProjetos(projetos.filter(projeto => projeto.id !== id));
      toast({
        title: "Projeto excluído",
        description: "O projeto foi removido com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir o projeto.",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'completed': return 'Concluído';
      case 'paused': return 'Pausado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getProjectTypeLabel = (projectType: string) => {
    switch (projectType) {
      case 'website': return 'Site institucional';
      case 'ecommerce': return 'E-commerce';
      case 'landing_page': return 'Landing Page';
      case 'other': return 'Outro';
      default: return projectType;
    }
  };

  // Calcular estatísticas reais dos projetos
  const stats = calculateProjectStats(projetos);

  const openPayment = (project: Project) => {
    setPaymentProject(project);
    setPaymentAmount('');
    setPaymentDate(todayDateOnly());
    setPaymentKey(crypto.randomUUID());
  };

  const submitPayment = async () => {
    if (!paymentProject) return;
    const amount = Number(paymentAmount.replace(',', '.'));
    const balance = Math.max(0, projectValue(paymentProject.project_value) - projectValue(paymentProject.paid_value));
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance || !paymentDate) {
      toast({ title: 'Pagamento inválido', description: `Informe um valor positivo até ${balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} e uma data.`, variant: 'destructive' });
      return;
    }
    setPaymentLoading(true);
    try {
      await recordProjectPayment(paymentProject.id, { amount, competence_date: paymentDate, idempotency_key: paymentKey });
      setPaymentProject(null);
      await loadProjects();
      toast({ title: 'Pagamento registrado', description: 'O pagamento foi registrado com sucesso.' });
    } catch (error) {
      toast({ title: 'Não foi possível registrar', description: error instanceof Error ? error.message : 'Erro interno do servidor', variant: 'destructive' });
    } finally { setPaymentLoading(false); }
  };

  const openHistory = async (project: Project) => {
    setHistoryProject(project);
    try { setFinancialHistory(await getProjectFinancialHistory(project.id)); }
    catch { setFinancialHistory({ baseline: null, events: [] }); toast({ title: 'Erro', description: 'Não foi possível carregar o histórico.', variant: 'destructive' }); }
  };
  
  // Filtrar projetos baseado na pesquisa e filtros
  const filteredProjects = projetos.filter(projeto => {
    // Filtro por termo de pesquisa
    const matchesSearch = projeto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (projeto.client && projeto.client.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (projeto.description && projeto.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filtro por aba ativa
    let matchesTab = true;
    if (activeTab === 'active') {
      matchesTab = projeto.status === 'active' || projeto.status === 'paused';
    } else if (activeTab === 'completed') {
      matchesTab = projeto.status === 'completed';
    }
    
    // Filtro por status
    const matchesStatus = statusFilter === 'all' || projeto.status === statusFilter;
    
    return matchesSearch && matchesTab && matchesStatus;
  });

  // Configurar paginação
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    totalItems,
    paginatedData: paginatedProjects,
    setCurrentPage,
    setItemsPerPage
  } = usePagination({
    data: filteredProjects,
    initialItemsPerPage: 10
  });
  
  // Função para marcar projeto como concluído
  const handleCompleteProject = async (projeto: Project) => {
    const projectId = String(projeto.id);
    if (completingProjects.includes(projectId)) return;

    setCompletingProjects(prev => [...prev, projectId]);
    try {
      const updatedProject = {
        status: 'completed' as const,
        completion_date: todayDateOnly()
      };
      
      const completedProject = await updateProject(projectId, updatedProject);
      
      if (completedProject) {
        setProjetos(prev => prev.map(item => String(item.id) === projectId ? completedProject : item));
        toast({
          title: "Projeto concluído",
          description: "O projeto foi marcado como concluído com sucesso.",
        });
      } else {
        toast({
          title: "Erro",
          description: "Falha ao atualizar o projeto no servidor.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao concluir projeto:', error);
      toast({
        title: "Erro",
        description: "Erro ao concluir o projeto.",
        variant: "destructive"
      });
    } finally {
      setCompletingProjects(prev => prev.filter(id => id !== projectId));
    }
  };
  
  // Funções para seleção múltipla
  const handleSelectProject = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };
  
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(filteredProjects.map(p => String(p.id)));
    }
    setSelectAll(!selectAll);
  };
  
  // Ações em massa
  const handleBulkStatusChange = async (newStatus: string) => {
    try {
      for (const projectId of selectedProjects) {
        const projeto = projetos.find(p => String(p.id) === projectId);
        if (projeto) {
          const updatedProject = newStatus === 'completed'
            ? {
                status: 'completed' as const,
                completion_date: todayDateOnly()
              }
            : {
                ...projeto,
                status: newStatus as any
              };
          await updateProject(projectId, updatedProject);
        }
      }
      
      await loadProjects();
      setSelectedProjects([]);
      setSelectAll(false);
      
      toast({
        title: "Projetos atualizados",
        description: `${selectedProjects.length} projeto(s) foram atualizados.`,
      });
    } catch (error) {
      console.error('Erro ao atualizar projetos:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar os projetos.",
        variant: "destructive"
      });
    }
  };
  
  const handleBulkDelete = async () => {
    try {
      for (const projectId of selectedProjects) {
        await deleteProject(projectId);
      }
      
      await loadProjects();
      setSelectedProjects([]);
      setSelectAll(false);
      
      toast({
        title: "Projetos excluídos",
        description: `${selectedProjects.length} projeto(s) foram excluídos.`,
      });
    } catch (error) {
      console.error('Erro ao excluir projetos:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir os projetos.",
        variant: "destructive"
      });
    }
  };
  
  // Atualizar selectAll quando a seleção muda
  useEffect(() => {
    setSelectAll(selectedProjects.length === filteredProjects.length && filteredProjects.length > 0);
  }, [selectedProjects, filteredProjects]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Carregando projetos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projetos</h1>
          <p className="text-muted-foreground">Gerencie todos os seus projetos de web design</p>
        </div>
        <NovoProjetoDialog 
          onProjectChange={loadProjects}
        >
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        </NovoProjetoDialog>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-xl font-bold">{stats.emAndamento}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Finalizados</p>
                <p className="text-xl font-bold">{stats.finalizados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturamento</p>
                <p className="text-xl font-bold">
                  {stats.faturamentoTotal.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-xl font-bold">
                  {stats.valorPendente.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Projetos */}
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-4">
            <CardTitle>Lista de Projetos</CardTitle>
            
            {/* Abas de Paginação */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
              <Button
                variant={activeTab === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('all')}
                className="text-xs"
              >
                Todos
              </Button>
              <Button
                variant={activeTab === 'active' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('active')}
                className="text-xs"
              >
                Projetos Ativos
              </Button>
              <Button
                variant={activeTab === 'completed' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('completed')}
                className="text-xs"
              >
                Projetos Concluídos
              </Button>
            </div>
            
            {/* Filtros e Pesquisa */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Pesquisar projetos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Ações em Massa */}
            {selectedProjects.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground self-center">
                  {selectedProjects.length} projeto(s) selecionado(s)
                </span>
                
                <Select onValueChange={handleBulkStatusChange}>
                  <SelectTrigger className="w-48">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Alterar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Marcar como Ativo</SelectItem>
                    <SelectItem value="paused">Marcar como Pausado</SelectItem>
                    <SelectItem value="completed">Marcar como Concluído</SelectItem>
                    <SelectItem value="cancelled">Marcar como Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir Selecionados
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredProjects.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">
                {projetos.length === 0 
                  ? "Nenhum projeto encontrado. Crie seu primeiro projeto!" 
                  : "Nenhum projeto encontrado com os filtros aplicados."
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome do Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor do Projeto</TableHead>
                  <TableHead>Valor Pago</TableHead>
                  <TableHead>Data de Entrega</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProjects.map((projeto) => (
                  <TableRow key={projeto.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProjects.includes(String(projeto.id))}
                        onCheckedChange={() => handleSelectProject(String(projeto.id))}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <p className="font-semibold">{projeto.name}</p>
                        {projeto.description && (
                          <p className="text-sm text-muted-foreground">{projeto.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{projeto.client || '-'}</TableCell>
                    <TableCell>{projeto.project_type ? getProjectTypeLabel(projeto.project_type) : '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(projeto.status)}>
                        {getStatusLabel(projeto.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {projeto.project_value ? 
                        Number(projeto.project_value).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }) : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {projeto.paid_value ? 
                        Number(projeto.paid_value).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }) : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {projeto.delivery_date ? 
                        new Date(projeto.delivery_date).toLocaleDateString('pt-BR') : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(projeto.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end flex-wrap">
                        {projeto.status !== 'completed' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={completingProjects.includes(String(projeto.id))}
                            onClick={() => handleCompleteProject(projeto)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            {completingProjects.includes(String(projeto.id)) ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Calendar className="h-4 w-4 mr-1" />
                            )}
                            {completingProjects.includes(String(projeto.id)) ? 'Concluindo' : 'Concluir'}
                          </Button>
                        )}
                        
                        <NovoProjetoDialog 
                          projeto={projeto} 
                          onProjectChange={loadProjects}
                        >
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </NovoProjetoDialog>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteProject(projeto.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openPayment(projeto)} disabled={projeto.status === 'cancelled' || Math.max(0, projectValue(projeto.project_value) - projectValue(projeto.paid_value)) <= 0}>
                          <Receipt className="h-4 w-4 mr-1" />
                          Pagamento
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openHistory(projeto)} title="Ver histórico financeiro" aria-label={`Ver histórico financeiro de ${projeto.name}`}>
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Componente de Paginação */}
          {filteredProjects.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </CardContent>
      </Card>
      {paymentProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="payment-title">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <h2 id="payment-title" className="text-lg font-semibold">Registrar pagamento</h2>
            <p className="mt-1 text-sm text-muted-foreground">{paymentProject.name}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-muted-foreground">Contratado</span><strong className="block">{projectValue(paymentProject.project_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
              <div><span className="text-muted-foreground">Pago</span><strong className="block">{projectValue(paymentProject.paid_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
              <div><span className="text-muted-foreground">Pendente</span><strong className="block">{Math.max(0, projectValue(paymentProject.project_value) - projectValue(paymentProject.paid_value)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
            </div>
            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium">Valor do pagamento<input className="mt-1 w-full rounded-md border bg-background p-2" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label>
              <label className="block text-sm font-medium">Data de competência<input className="mt-1 w-full rounded-md border bg-background p-2" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setPaymentProject(null)} disabled={paymentLoading}>Cancelar</Button><Button onClick={submitPayment} disabled={paymentLoading}>{paymentLoading ? 'Registrando...' : 'Confirmar pagamento'}</Button></div>
          </div>
        </div>
      )}
      {historyProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="history-title">
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl">
            <h2 id="history-title" className="text-lg font-semibold">Histórico financeiro</h2>
            <p className="mt-1 text-sm text-muted-foreground">{historyProject.name}</p>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {financialHistory.baseline && <div className="rounded-md border border-dashed p-3 text-sm"><div className="flex justify-between"><span>Linha de base legada</span><strong>{projectValue(financialHistory.baseline.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div><p className="text-xs text-muted-foreground">Competência desconhecida</p></div>}
              {financialHistory.events.map((event) => <div key={event.id} className="rounded-md border p-3 text-sm"><div className="flex justify-between"><span>{event.event_type === 'completion_settlement' ? 'Quitação automática' : 'Pagamento recebido'}</span><strong>{projectValue(event.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div><p className="text-xs text-muted-foreground">{event.competence_date || 'Competência desconhecida'} · {event.origin}</p></div>)}
              {!financialHistory.baseline && financialHistory.events.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lançamento financeiro registrado.</p>}
            </div>
            <div className="mt-6 flex justify-end"><Button onClick={() => setHistoryProject(null)}>Fechar</Button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjetosPage;
