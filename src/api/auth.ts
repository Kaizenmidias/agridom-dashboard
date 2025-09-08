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
      localStorage.setItem('token', result.token)
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
    const token = localStorage.getItem('token')
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
  const result = await authAPI.uploadAvatar(file);
  
  if (result.success) {
    return result.user;
  } else {
    throw new Error(result.error || 'Erro ao fazer upload do avatar');
  }
}

export async function registerUser(credentials: RegisterCredentials): Promise<AuthResponse> {
  const result = await authAPI.register(credentials);
  
  if (result.success) {
    if (result.token) {
      localStorage.setItem('token', result.token);
    }
    return result;
  } else {
    throw new Error(result.error || 'Erro ao registrar usuário');
  }
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
  role?: string;
  bio?: string;
  avatar_url?: string;
}): Promise<AuthUser> {
  const result = await authAPI.updateProfile(userData);
  
  if (result.success) {
    return result.user;
  } else {
    throw new Error(result.error || 'Erro ao atualizar perfil');
  }
}