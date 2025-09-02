import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, User, Mail, Shield, Calendar, Settings, Users, UserCheck, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/use-mariadb';
import { createUser, updateUser, deleteUser } from '@/api/crud';
import { User as UserType } from '@/types/database';

const UsuariosPage = () => {
  const { user, refreshUserData } = useAuth();
  const { data: usuarios, loading, error, refetch } = useUsers();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    position: 'Web Designer',
    permissions: {
      dashboard: false,
      projetos: false,
      despesas: false,
      crm: false,
      briefings: false,
      codes: false,
      usuarios: false
    }
  });

  const isAdmin = user?.position === 'Administrador';

  // Função para resetar o formulário
  const resetForm = () => {
    setNewUser({
      full_name: '',
      email: '',
      password: '',
      position: 'Web Designer',
      permissions: {
        dashboard: false,
        projetos: false,
        despesas: false,
        crm: false,
        briefings: false,
        codes: false,
        usuarios: false
      }
    });
  };

  const handleCreateUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsCreating(true);
    try {
      await createUser({
        full_name: newUser.full_name,
        email: newUser.email,
        password_hash: newUser.password, // O backend deve fazer o hash
        position: newUser.position,
        permissions: JSON.stringify(newUser.permissions),
        is_active: true
      });
      
      resetForm();
      setIsDialogOpen(false);
      refetch(); // Recarrega a lista de usuários
      alert('Usuário criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      alert('Erro ao criar usuário. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = (usuario: UserType) => {
    setSelectedUser({
      ...usuario,
      permissions: usuario.permissions ? JSON.parse(usuario.permissions) : {}
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = (usuario: UserType) => {
    setSelectedUser(usuario);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    try {
      await deleteUser(selectedUser.id);
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      refetch(); // Recarrega a lista de usuários
      alert('Usuário excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      alert('Erro ao excluir usuário. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const saveEditUser = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      await updateUser(selectedUser.id, {
        full_name: selectedUser.full_name,
        email: selectedUser.email,
        position: selectedUser.position,
        is_active: selectedUser.is_active,
        can_access_dashboard: selectedUser.can_access_dashboard,
        can_access_briefings: selectedUser.can_access_briefings,
        can_access_codes: selectedUser.can_access_codes,
        can_access_projects: selectedUser.can_access_projects,
        can_access_expenses: selectedUser.can_access_expenses,
        can_access_crm: selectedUser.can_access_crm,
        can_access_users: selectedUser.can_access_users
      });
      
      // Se o usuário editado é o usuário logado, atualizar suas permissões
      if (user && selectedUser.id === user.id) {
        await refreshUserData();
      }
      
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      refetch(); // Recarrega a lista de usuários
      alert('Usuário atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      alert('Erro ao atualizar usuário. Tente novamente.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setNewUser(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: checked
      }
    }));
  };
  // Usar dados reais do banco de dados
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-center items-center h-64">
          <p>Carregando usuários...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-center items-center h-64">
          <p className="text-red-600">Erro ao carregar usuários: {error.message}</p>
        </div>
      </div>
    );
  }

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
      case 'Web Designer': return 'bg-blue-100 text-blue-800';
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

  const usuariosAtivos = usuarios?.filter(u => u.is_active).length || 0;
  const totalUsuarios = usuarios?.length || 0;
  const administradores = usuarios?.filter(u => u.position === 'Administrador').length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Gerencie usuários e permissões do sistema</p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha as informações do novo usuário e defina suas permissões de acesso.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="full_name" className="text-right">
                    Nome Completo
                  </Label>
                  <Input
                    id="full_name"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">
                    Senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="position" className="text-right">
                    Cargo
                  </Label>
                  <Select value={newUser.position} onValueChange={(value) => setNewUser(prev => ({ ...prev, position: value }))}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Web Designer">Web Designer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3">
                  <Label className="text-sm font-medium">Permissões de Acesso</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries({
                      dashboard: 'Dashboard',
                      projetos: 'Projetos',
                      despesas: 'Despesas',
                      crm: 'CRM',
                      briefings: 'Briefings',
                      codes: 'Códigos',
                      usuarios: 'Usuários'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={key}
                          checked={newUser.permissions[key as keyof typeof newUser.permissions]}
                          onCheckedChange={(checked) => handlePermissionChange(key, checked as boolean)}
                        />
                        <Label htmlFor={key} className="text-sm">{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" onClick={handleCreateUser} disabled={isCreating}>
                  {isCreating ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
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
                <p className="text-xl font-bold">{totalUsuarios}</p>
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
                <p className="text-xl font-bold">{administradores}</p>
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

      {/* Lista de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
          <CardDescription>Gerencie contas de usuário e suas permissões</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usuarios?.map((usuario) => {
              const initials = usuario.full_name ? usuario.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
              return (
                <div key={usuario.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">{initials}</span>
                    </div>
                    <div>
                      <p className="font-medium">{usuario.full_name || 'Nome não informado'}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{usuario.email}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Último acesso: {usuario.last_login ? new Date(usuario.last_login).toLocaleDateString('pt-BR') : 'Nunca'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right space-y-1">
                      <div className="flex space-x-2">
                        <Badge className={getRoleColor(usuario.position || 'Sem cargo')}>
                          {usuario.position || 'Sem cargo'}
                        </Badge>
                        <Badge className={getStatusColor(usuario.is_active ? 'Ativo' : 'Inativo')}>
                          {usuario.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Criado em: {new Date(usuario.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(usuario)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(usuario)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Editar Usuário */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Edite as informações do usuário selecionado.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-full_name" className="block text-sm font-medium mb-2">
                    Nome Completo
                  </Label>
                  <Input
                    id="edit-full_name"
                    value={selectedUser.full_name}
                    onChange={(e) => setSelectedUser(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email" className="block text-sm font-medium mb-2">
                    Email
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={selectedUser.email}
                    onChange={(e) => setSelectedUser(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-position" className="block text-sm font-medium mb-2">
                    Cargo
                  </Label>
                  <Select value={selectedUser.position} onValueChange={(value) => setSelectedUser(prev => ({ ...prev, position: value }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Web Designer">Web Designer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-status" className="block text-sm font-medium mb-2">
                    Status
                  </Label>
                  <Select value={selectedUser.is_active ? 'Ativo' : 'Inativo'} onValueChange={(value) => setSelectedUser(prev => ({ ...prev, is_active: value === 'Ativo' }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
                {/* Seção de Permissões */}
                <div>
                  <Label className="block text-sm font-medium mb-2">Permissões de Acesso</Label>
                  <div className="space-y-3 border rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="dashboard"
                        checked={selectedUser.can_access_dashboard || false}
                        onChange={(e) => setSelectedUser(prev => ({ ...prev, can_access_dashboard: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="dashboard" className="text-sm">Dashboard</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="briefings"
                        checked={selectedUser.can_access_briefings || false}
                        onChange={(e) => setSelectedUser(prev => ({ ...prev, can_access_briefings: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="briefings" className="text-sm">Briefings</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="codes"
                        checked={selectedUser.can_access_codes || false}
                        onChange={(e) => setSelectedUser(prev => ({ ...prev, can_access_codes: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="codes" className="text-sm">Códigos</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="projects"
                        checked={selectedUser.can_access_projects || false}
                        onChange={(e) => setSelectedUser(prev => ({ ...prev, can_access_projects: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="projects" className="text-sm">Projetos</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="expenses"
                        checked={selectedUser.can_access_expenses || false}
                        onChange={(e) => setSelectedUser(prev => ({ ...prev, can_access_expenses: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="expenses" className="text-sm">Despesas</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="crm"
                        checked={selectedUser.can_access_crm || false}
                        onChange={(e) => setSelectedUser(prev => ({ ...prev, can_access_crm: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="crm" className="text-sm">CRM</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="users"
                        checked={selectedUser.can_access_users || false}
                        onChange={(e) => setSelectedUser(prev => ({ ...prev, can_access_users: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="users" className="text-sm">Usuários</Label>
                    </div>
                  </div>
                </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEditUser} disabled={isUpdating}>
              {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Excluir Usuário */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center space-x-4 p-4 border rounded-lg bg-muted/50">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {selectedUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedUser.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <Badge className={getRoleColor(selectedUser.position)}>
                    {selectedUser.position}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteUser} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Excluir Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsuariosPage;