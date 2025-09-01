import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, User, Mail, Shield, Calendar, Settings, Users, UserCheck } from 'lucide-react';

const UsuariosPage = () => {
  const usuarios = [
    {
      id: 1,
      nome: "João Silva",
      email: "joao@kaizen.com",
      role: "Administrador",
      status: "Ativo",
      ultimoAcesso: "2024-01-22",
      avatar: "JS",
      projetos: 8
    },
    {
      id: 2,
      nome: "Maria Santos",
      email: "maria@kaizen.com", 
      role: "Designer",
      status: "Ativo",
      ultimoAcesso: "2024-01-22",
      avatar: "MS",
      projetos: 5
    },
    {
      id: 3,
      nome: "Pedro Costa",
      email: "pedro@kaizen.com",
      role: "Desenvolvedor",
      status: "Ativo", 
      ultimoAcesso: "2024-01-21",
      avatar: "PC",
      projetos: 3
    },
    {
      id: 4,
      nome: "Ana Oliveira",
      email: "ana@kaizen.com",
      role: "Designer",
      status: "Inativo",
      ultimoAcesso: "2024-01-15",
      avatar: "AO",
      projetos: 2
    }
  ];

  const permissoes = [
    { id: 1, nome: "Gerenciar Projetos", descricao: "Criar, editar e excluir projetos" },
    { id: 2, nome: "Gerenciar Clientes", descricao: "Acesso total ao CRM" },
    { id: 3, nome: "Visualizar Financeiro", descricao: "Ver relatórios financeiros" },
    { id: 4, nome: "Gerenciar Usuários", descricao: "Adicionar e editar usuários" },
    { id: 5, nome: "Configurações", descricao: "Alterar configurações do sistema" }
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Administrador': return 'bg-red-100 text-red-800';
      case 'Designer': return 'bg-blue-100 text-blue-800';
      case 'Desenvolvedor': return 'bg-green-100 text-green-800';
      case 'Cliente': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ativo': return 'bg-green-100 text-green-800';
      case 'Inativo': return 'bg-gray-100 text-gray-800';
      case 'Pendente': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const usuariosAtivos = usuarios.filter(u => u.status === 'Ativo').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Gerencie usuários e permissões do sistema</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Estatísticas de Usuários */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Usuários</p>
                <p className="text-xl font-bold">{usuarios.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Usuários Ativos</p>
                <p className="text-xl font-bold">{usuariosAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <Shield className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Administradores</p>
                <p className="text-xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Online Hoje</p>
                <p className="text-xl font-bold">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Usuários */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Usuários do Sistema</CardTitle>
              <CardDescription>Gerencie contas de usuário e suas permissões</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usuarios.map((usuario) => (
                  <div key={usuario.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">{usuario.avatar}</span>
                      </div>
                      <div>
                        <p className="font-medium">{usuario.nome}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{usuario.email}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Último acesso: {new Date(usuario.ultimoAcesso).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex space-x-2">
                        <Badge className={getRoleColor(usuario.role)}>
                          {usuario.role}
                        </Badge>
                        <Badge className={getStatusColor(usuario.status)}>
                          {usuario.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{usuario.projetos} projeto(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Permissões e Ações */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permissões do Sistema</CardTitle>
              <CardDescription>Configurações de acesso</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {permissoes.map((permissao) => (
                  <div key={permissao.id} className="p-3 border rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <Shield className="h-4 w-4 text-primary" />
                      <h4 className="font-medium text-sm">{permissao.nome}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{permissao.descricao}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Convidar Usuário
              </Button>
              <Button variant="outline" className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Roles
              </Button>
              <Button variant="outline" className="w-full">
                <User className="h-4 w-4 mr-2" />
                Relatório de Acesso
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UsuariosPage;