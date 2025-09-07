import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Users, UserCheck, UserX, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createUser, updateUser, deleteUser } from '@/api/crud';
import { User, InsertUser, AuthUser } from '@/types/database';
import { toast } from '@/hooks/use-toast';

const UsuariosPage = () => {
  const { user, usuarios, loading, error, isAdmin, refreshUserData } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: ''
  });

  const resetForm = () => {
    setNewUser({
      full_name: '',
      email: '',
      password: '',
      role: ''
    });
  };

  const handleCreateUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      await createUser({
        email: newUser.email,
        password_hash: newUser.password, // Será hasheado no backend
        full_name: newUser.full_name || null,
        role: newUser.role || 'user',
        bio: null,
        avatar_url: null,
        is_active: true
      });

      toast({
        title: 'Sucesso',
        description: 'Usuário criado com sucesso!',
      });

      resetForm();
      setIsDialogOpen(false);
      // Recarregar dados sem refresh da página
      refreshUserData();
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao criar usuário', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = (usuario: AuthUser) => {
    setSelectedUser({
      id: usuario.id,
      email: usuario.email,
      full_name: usuario.full_name,
      role: usuario.role,
      is_active: usuario.is_active
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = (usuario: AuthUser) => {
    setSelectedUser(usuario);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    try {
      await deleteUser(selectedUser.id);
      toast({ title: 'Sucesso', description: 'Usuário excluído com sucesso!' });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      // Recarregar dados sem refresh da página
      refreshUserData();
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir usuário', variant: 'destructive' });
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
        role: selectedUser.role,
        is_active: selectedUser.is_active
        // password_hash será mantido como está no banco
      });

      if (user && selectedUser.id === user.id) {
        toast({
          title: 'Sucesso',
          description: 'Perfil atualizado! Faça login novamente para ver as mudanças.',
        });
      } else {
        toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso!' });
      }

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      // Recarregar dados sem refresh da página
      refreshUserData();
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar usuário', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };



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
          <p className="text-red-600">Erro ao carregar usuários: {error}</p>
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

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'user':
        return 'Colaborador';
      default:
        return role || 'Sem cargo';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'user':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
  const administradores = usuarios?.filter(u => u.role === 'admin').length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground">Gerencie usuarios e permissoes do sistema</p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha as informações do novo usuário.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="full_name" className="text-right">
                    Nome
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
                  <Label htmlFor="role" className="text-right">
                    Cargo
                  </Label>
                  <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="user">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
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
                <UserX className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Usuários Inativos</p>
                <p className="text-xl font-bold">{totalUsuarios - usuariosAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Administradores</p>
                <p className="text-xl font-bold">{administradores}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usuarios?.map((usuario) => {
              return (
                <div key={usuario.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">{usuario.full_name?.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <h3 className="font-medium">{usuario.full_name}</h3>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>{usuario.email}</span>
                      </div>

                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right space-y-1">
                      <div className="flex space-x-2">
                        <Badge className={getRoleColor(usuario.role)}>
                          {getRoleDisplayName(usuario.role)}
                        </Badge>
                        <Badge className={getStatusColor(usuario.is_active ? 'Ativo' : 'Inativo')}>
                          {usuario.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(usuario)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(usuario)}
                        >
                          Excluir
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

      {selectedUser && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Edite as informações do usuário.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-full_name" className="block text-sm font-medium mb-2">
                    Nome Completo
                  </Label>
                  <Input
                    id="edit-full_name"
                    value={selectedUser.full_name}
                    onChange={(e) => setSelectedUser(prev => ({ ...prev!, full_name: e.target.value }))}
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
                    onChange={(e) => setSelectedUser(prev => ({ ...prev!, email: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-role" className="block text-sm font-medium mb-2">
                    Cargo
                  </Label>
                  <Select value={selectedUser.role} onValueChange={(value) => setSelectedUser(prev => ({ ...prev!, role: value }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="user">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-status" className="block text-sm font-medium mb-2">
                    Status
                  </Label>
                  <Select value={selectedUser.is_active ? 'Ativo' : 'Inativo'} onValueChange={(value) => setSelectedUser(prev => ({ ...prev!, is_active: value === 'Ativo' }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>
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
      )}

      {selectedUser && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center space-x-4 p-4 border rounded-lg bg-muted/50">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {selectedUser.full_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium">{selectedUser.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <Badge className={getRoleColor(selectedUser.role)}>
                    {getRoleDisplayName(selectedUser.role)}
                  </Badge>
                </div>
              </div>
            </div>
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
      )}
    </div>
  );
};

export default UsuariosPage;