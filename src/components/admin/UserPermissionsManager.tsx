import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { useToast } from '../ui/use-toast'
import { AuthUser } from '../../types/database'
import { 
  getNonAdminUsers, 
  getUserPermissions, 
  updateUserPermissions,
  UserWithPermissions,
  AVAILABLE_PERMISSIONS,
  PermissionKey
} from '../../api/permissions'

interface UserPermission {
  permission_name: string
  permission_value: boolean
  display_name: string
  description: string
}

const AVAILABLE_PERMISSIONS: UserPermission[] = [
  {
    permission_name: 'can_access_dashboard',
    permission_value: false,
    display_name: 'Acessar Dashboard',
    description: 'Permite acesso à página principal do sistema'
  },
  {
    permission_name: 'can_access_projects',
    permission_value: false,
    display_name: 'Acessar Projetos',
    description: 'Permite visualizar a seção de projetos'
  },
  {
    permission_name: 'can_access_briefings',
    permission_value: false,
    display_name: 'Acessar Briefings',
    description: 'Permite visualizar briefings de projetos'
  },
  {
    permission_name: 'can_access_reports',
    permission_value: false,
    display_name: 'Acessar Relatórios',
    description: 'Permite visualizar relatórios do sistema'
  },
  {
    permission_name: 'can_access_settings',
    permission_value: false,
    display_name: 'Acessar Configurações',
    description: 'Permite acessar configurações do sistema'
  },
  {
    permission_name: 'can_manage_projects',
    permission_value: false,
    display_name: 'Gerenciar Projetos',
    description: 'Permite criar, editar e excluir projetos'
  },
  {
    permission_name: 'can_manage_briefings',
    permission_value: false,
    display_name: 'Gerenciar Briefings',
    description: 'Permite criar, editar e excluir briefings'
  },
  {
    permission_name: 'can_manage_reports',
    permission_value: false,
    display_name: 'Gerenciar Relatórios',
    description: 'Permite criar e configurar relatórios'
  }
]

interface UserPermissionsManagerProps {
  currentUser: AuthUser
}

export function UserPermissionsManager({ currentUser }: UserPermissionsManagerProps) {
  const [users, setUsers] = useState<UserWithPermissions[]>([])
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null)
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Carregar lista de usuários
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const usersList = await getNonAdminUsers()
      setUsers(usersList)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de usuários',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Carregar permissões do usuário selecionado
  useEffect(() => {
    if (selectedUser) {
      loadUserPermissions(selectedUser)
    }
  }, [selectedUser])

  const loadUserPermissions = async (user: UserWithPermissions) => {
    try {
      const userPermissionsData = await getUserPermissions(user.id)
      
      // Mapear permissões atuais do usuário
      const userPermissions = Object.entries(AVAILABLE_PERMISSIONS).map(([key, perm]) => ({
        permission_name: key,
        permission_value: userPermissionsData.permissions[key] || false,
        display_name: perm.display_name,
        description: perm.description
      }))
      setPermissions(userPermissions)
    } catch (error) {
      console.error('Erro ao carregar permissões:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as permissões do usuário',
        variant: 'destructive'
      })
    }
  }

  const handlePermissionChange = (permissionName: string, value: boolean) => {
    setPermissions(prev => 
      prev.map(perm => 
        perm.permission_name === permissionName 
          ? { ...perm, permission_value: value }
          : perm
      )
    )
  }

  const savePermissions = async () => {
    if (!selectedUser) return

    try {
      setSaving(true)
      
      const permissionsToSave = permissions.reduce((acc, perm) => {
        acc[perm.permission_name] = perm.permission_value
        return acc
      }, {} as Record<string, boolean>)

      await updateUserPermissions(
        selectedUser.id, 
        permissionsToSave,
        `Permissões atualizadas pelo administrador em ${new Date().toLocaleString()}`
      )
      
      toast({
        title: 'Sucesso',
        description: `Permissões de ${selectedUser.full_name} atualizadas com sucesso`,
        variant: 'default'
      })
      
      // Recarregar lista de usuários para refletir mudanças
      await loadUsers()
      
      // Recarregar permissões do usuário selecionado
      if (selectedUser) {
        await loadUserPermissions(selectedUser)
      }
      
    } catch (error) {
      console.error('Erro ao salvar permissões:', error)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível salvar as permissões',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadgeColor = (role: string | null) => {
    if (!role) return 'secondary'
    const lowerRole = role.toLowerCase()
    if (['web_designer', 'web designer', 'designer'].includes(lowerRole)) {
      return 'default'
    }
    return 'secondary'
  }

  // Verificar se o usuário atual é administrador
  if (!currentUser.is_admin) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Acesso negado. Apenas administradores podem gerenciar permissões.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Permissões de Usuários</CardTitle>
          <CardDescription>
            Configure as permissões específicas para usuários não-administradores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seletor de usuário */}
          <div className="space-y-2">
            <Label htmlFor="user-select">Selecionar Usuário</Label>
            <Select
              value={selectedUser?.id || ''}
              onValueChange={(userId) => {
                const user = users.find(u => u.id === userId)
                setSelectedUser(user || null)
              }}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha um usuário para configurar" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <span>{user.full_name || user.email}</span>
                      <Badge variant={getRoleBadgeColor(user.role)}>
                        {user.role || 'Sem cargo'}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Informações do usuário selecionado */}
          {selectedUser && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{selectedUser.full_name || selectedUser.email}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <Badge variant={getRoleBadgeColor(selectedUser.role)}>
                  {selectedUser.role || 'Sem cargo'}
                </Badge>
              </div>
            </div>
          )}

          <Separator />

          {/* Configuração de permissões */}
          {selectedUser && permissions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Configurar Permissões</h3>
              
              <div className="grid gap-4">
                {permissions.map((permission) => (
                  <div key={permission.permission_name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor={permission.permission_name} className="text-sm font-medium">
                        {permission.display_name}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {permission.description}
                      </p>
                    </div>
                    <Switch
                      id={permission.permission_name}
                      checked={permission.permission_value}
                      onCheckedChange={(checked) => 
                        handlePermissionChange(permission.permission_name, checked)
                      }
                      disabled={saving}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedUser(null)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={savePermissions}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar Permissões'}
                </Button>
              </div>
            </div>
          )}

          {/* Estado vazio */}
          {!selectedUser && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Selecione um usuário para configurar suas permissões</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default UserPermissionsManager