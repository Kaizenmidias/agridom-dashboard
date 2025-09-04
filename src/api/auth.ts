import { AuthUser } from '../types/database'
import { API_BASE_URL } from '../config/api'

interface LoginCredentials {
  email: string
  password: string
}

interface RegisterCredentials {
  email: string
  password: string
  full_name?: string
}

interface AuthResponse {
  user: AuthUser
  token: string
}

export async function loginUser(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro no login')
  }

  return await response.json()
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const token = localStorage.getItem('auth_token')
  
  const response = await fetch(`${API_BASE_URL}/change-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Erro ao alterar senha')
  }

  return response.json()
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
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Erro no registro')
  }

  return await response.json()
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE_URL}/verify`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    return null
  }

  return await response.json()
}

export async function updateUserProfile(userData: {
  full_name?: string;
  position?: string;
  bio?: string;
  avatar_url?: string;
}): Promise<AuthUser> {
  const token = localStorage.getItem('auth_token')
  
  const response = await fetch(`${API_BASE_URL}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: JSON.stringify(userData),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(error.error || 'Erro ao atualizar perfil')
  }

  return await response.json()
}