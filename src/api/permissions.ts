import { API_BASE_URL } from '../config/api'

export interface UserPermission {
  permission_name: string
  permission_value: boolean
  granted_by?: number
  granted_at?: string
  notes?: string
  granted_by_name?: string
}

export interface UserWithPermissions {
  id: string
  email: string
  full_name: string | null
  role: string | null
  is_active: boolean
  is_admin: boolean
  permissions: Record<string, boolean>
}

export interface RoleDefinition {
  role_name: string
  display_name: string
  description: string | null
  is_admin: boolean
  default_permissions: Record<string, boolean>
  created_at: string
  updated_at: string
}

// Obter lista de usuários não-administradores
export async function getNonAdminUsers(): Promise<UserWithPermissions[]> {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${API_BASE_URL}/permissions/users`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao buscar usuários')
  }

  return response.json()
}

// Obter permissões de um usuário específico
export async function getUserPermissions(userId: string): Promise<{
  user: UserWithPermissions
  permissions: Record<string, boolean>
  custom_permissions: UserPermission[]
}> {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${API_BASE_URL}/permissions/user/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao buscar permissões do usuário')
  }

  return response.json()
}

// Atualizar permissões de um usuário
export async function updateUserPermissions(
  userId: string, 
  permissions: Record<string, boolean>,
  notes?: string
): Promise<{
  message: string
  user: UserWithPermissions
  permissions: Record<string, boolean>
}> {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${API_BASE_URL}/permissions/user/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ permissions, notes })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao atualizar permissões')
  }

  return response.json()
}

// Obter definições de cargos
export async function getRoleDefinitions(): Promise<RoleDefinition[]> {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${API_BASE_URL}/permissions/roles`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao buscar definições de cargos')
  }

  return response.json()
}

// Criar nova definição de cargo
export async function createRoleDefinition(roleData: {
  role_name: string
  display_name: string
  description?: string
  is_admin?: boolean
  default_permissions?: Record<string, boolean>
}): Promise<RoleDefinition> {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${API_BASE_URL}/permissions/roles`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(roleData)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao criar definição de cargo')
  }

  return response.json()
}

// Remover permissão personalizada específica
export async function removeCustomPermission(
  userId: string, 
  permissionName: string
): Promise<{ message: string }> {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${API_BASE_URL}/permissions/user/${userId}/custom/${permissionName}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro ao remover permissão personalizada')
  }

  return response.json()
}

// Constantes para permissões disponíveis
export const AVAILABLE_PERMISSIONS = {
  can_access_dashboard: {
    name: 'can_access_dashboard',
    display_name: 'Acessar Dashboard',
    description: 'Permite acesso à página principal do sistema'
  },
  can_access_projects: {
    name: 'can_access_projects',
    display_name: 'Acessar Projetos',
    description: 'Permite visualizar a seção de projetos'
  },
  can_access_briefings: {
    name: 'can_access_briefings',
    display_name: 'Acessar Briefings',
    description: 'Permite visualizar briefings de projetos'
  },
  can_access_users: {
    name: 'can_access_users',
    display_name: 'Acessar Usuários',
    description: 'Permite visualizar lista de usuários'
  },
  can_access_reports: {
    name: 'can_access_reports',
    display_name: 'Acessar Relatórios',
    description: 'Permite visualizar relatórios do sistema'
  },
  can_access_settings: {
    name: 'can_access_settings',
    display_name: 'Acessar Configurações',
    description: 'Permite acessar configurações do sistema'
  },
  can_manage_users: {
    name: 'can_manage_users',
    display_name: 'Gerenciar Usuários',
    description: 'Permite criar, editar e excluir usuários'
  },
  can_manage_projects: {
    name: 'can_manage_projects',
    display_name: 'Gerenciar Projetos',
    description: 'Permite criar, editar e excluir projetos'
  },
  can_manage_briefings: {
    name: 'can_manage_briefings',
    display_name: 'Gerenciar Briefings',
    description: 'Permite criar, editar e excluir briefings'
  },
  can_manage_reports: {
    name: 'can_manage_reports',
    display_name: 'Gerenciar Relatórios',
    description: 'Permite criar e configurar relatórios'
  },
  can_manage_settings: {
    name: 'can_manage_settings',
    display_name: 'Gerenciar Configurações',
    description: 'Permite alterar configurações do sistema'
  }
} as const

export type PermissionKey = keyof typeof AVAILABLE_PERMISSIONS