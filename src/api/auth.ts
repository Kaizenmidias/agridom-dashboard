import { authAPI } from './supabase-client'
import { AuthUser, LoginCredentials, RegisterCredentials, AuthResponse } from '../types/database'

// Função para fazer login
export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const result = await authAPI.login(credentials)

    if (result.error) {
      throw new Error(result.error)
    }

    // Salvar token no localStorage
    if (result.token) {
      localStorage.setItem('authToken', result.token)
    }

    return result
  } catch (error) {
    console.error('Erro no login:', error)
    throw error
  }
}

// Função para alterar senha
export const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean }> => {
  try {
    const token = localStorage.getItem('authToken')
    if (!token) {
      throw new Error('Token não encontrado')
    }

    // Decode token to get user ID
    const decoded = JSON.parse(atob(token))
    const result = await authAPI.changePassword(decoded.id, currentPassword, newPassword)

    if (result.error) {
      throw new Error(result.error)
    }

    return result
  } catch (error) {
    console.error('Erro ao alterar senha:', error)
    throw error
  }
}

export async function uploadAvatar(file: File): Promise<AuthUser | null> {
  const token = localStorage.getItem('auth_token')
  
  const formData = new FormData()
  formData.append('avatar', file)
  
  const response = await fetch(`${API_BASE_URL}/upload/avatar`, {
    method: 'POST',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(error.error || 'Erro ao fazer upload do avatar')
  }

  const result = await response.json()
  return result.user
}

export async function registerUser(credentials: RegisterCredentials): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_API_BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Erro no registro')
  }

  return data
}

// Função para verificar token
export const verifyToken = async (token: string): Promise<{ user: AuthUser; valid: boolean }> => {
  try {
    const result = await authAPI.verify(token)

    if (result.error) {
      throw new Error(result.error)
    }

    return result
  } catch (error) {
    console.error('Erro na verificação do token:', error)
    throw error
  }
}

export async function updateUserProfile(userData: {
  full_name?: string;
  position?: string;
  bio?: string;
  avatar_url?: string;
}): Promise<AuthUser> {
  const token = localStorage.getItem('auth_token')
  
  const response = await fetch(`${AUTH_API_BASE_URL}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: JSON.stringify(userData),
  })

  const data = await response.json().catch(() => ({ error: 'Erro desconhecido' }))

  if (!response.ok) {
    throw new Error(data.error || 'Erro ao atualizar perfil')
  }

  return data
}