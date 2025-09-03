import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, Plus, Calendar, DollarSign, User, TrendingUp, Clock, Search, Filter, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NovoProjetoDialog } from '@/components/novo-projeto-dialog';
import { getProjects, deleteProject, updateProject } from '@/api/crud';
import { Project } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

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

  // Função para carregar projetos do backend
  const loadProjects = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const projects = await getProjects();
      setProjetos(projects);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os projetos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Carregar projetos quando o componente montar
  useEffect(() => {
    loadProjects();
  }, [user, toast, loadProjects]);

  const handleDeleteProject = async (id: string) => {
    try {
      const success = await deleteProject(id);
      if (success) {
        setProjetos(projetos.filter(projeto => projeto.id !== id));
        toast({
          title: "Projeto excluído",
          description: "O projeto foi removido com sucesso.",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível excluir o projeto.",
          variant: "destructive"
        });
      }
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

  // Calcular estatísticas reais dos projetos
  const calculateProjectStats = () => {
    const emAndamento = projetos.filter(p => p.status === 'active' || p.status === 'paused').length;
    const finalizados = projetos.filter(p => p.status === 'completed').length;
    
    // Calcular faturamento total (soma dos valores pagos)
    const faturamentoTotal = projetos.reduce((total, projeto) => {
      const paidValue = Number(projeto.paid_value) || 0;
      return total + paidValue;
    }, 0);
    
    // Calcular valor pendente (valor total - valor pago)
    const valorPendente = projetos.reduce((total, projeto) => {
      const valorProjeto = Number(projeto.project_value) || 0;
      const valorPago = Number(projeto.paid_value) || 0;
      return total + (valorProjeto - valorPago);
    }, 0);
    
    return {
      emAndamento,
      finalizados,
      faturamentoTotal,
      valorPendente
    };
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
  
  // Função para marcar projeto como concluído
  const handleCompleteProject = async (projeto: Project) => {
    try {
      const updatedProject = {
        status: 'completed' as const,
        paid_value: projeto.project_value || 0, // Valor pendente vira pago
        completion_date: new Date().toISOString() // Registrar data de conclusão
      };
      
      const success = await updateProject(projeto.id, updatedProject);
      
      if (success) {
        await loadProjects(); // Recarregar projetos
        toast({
          title: "Projeto concluído",
          description: "O projeto foi marcado como concluído e o valor pendente foi contabilizado como pago.",
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
      setSelectedProjects(filteredProjects.map(p => p.id));
    }
    setSelectAll(!selectAll);
  };
  
  // Ações em massa
  const handleBulkStatusChange = async (newStatus: string) => {
    try {
      for (const projectId of selectedProjects) {
        const projeto = projetos.find(p => p.id === projectId);
        if (projeto) {
          const updatedProject = {
            ...projeto,
            status: newStatus as any,
            ...(newStatus === 'completed' && { 
              paid_value: projeto.project_value || 0,
              completion_date: new Date().toISOString()
            })
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

  const stats = calculateProjectStats();

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
                {filteredProjects.map((projeto) => (
                  <TableRow key={projeto.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProjects.includes(projeto.id)}
                        onCheckedChange={() => handleSelectProject(projeto.id)}
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
                    <TableCell>{projeto.project_type || '-'}</TableCell>
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
                            onClick={() => handleCompleteProject(projeto)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            Concluir
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjetosPage;