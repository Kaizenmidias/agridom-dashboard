import { crudAPI } from './supabase-client'
import { User, Project, Expense, Code, InsertUser, InsertProject, InsertExpense, InsertCode } from '../types/database'
import { API_BASE_URL } from '../config/api'
import { verifyToken } from './auth'

// Re-exportar tipos para uso em outros componentes
export type { User, Project, Expense, Code };

// Função auxiliar para verificar autenticação
const checkAuth = async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }
  
  // Verificação básica do formato do token JWT
  const tokenParts = token.split('.')
  if (tokenParts.length !== 3) {
    // Token malformado, limpar localStorage
    console.warn('Token malformado detectado, limpando dados de autenticação')
    localStorage.removeItem('token')
    localStorage.removeItem('user_data')
    localStorage.removeItem('user')
    localStorage.removeItem('last_token_verification')
    throw new Error('Token inválido')
  }
  
  // Verificar se o token não está expirado (verificação básica)
  try {
    const payload = JSON.parse(atob(tokenParts[1]))
    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.warn('Token expirado detectado, limpando dados de autenticação')
      localStorage.removeItem('token')
      localStorage.removeItem('user_data')
      localStorage.removeItem('user')
      localStorage.removeItem('last_token_verification')
      throw new Error('Token expirado')
    }
  } catch (e) {
    console.warn('Erro ao verificar expiração do token:', e)
    // Se não conseguir verificar, continua com o token (pode ser formato diferente)
  }
  
  return token
}

// === USUÁRIOS ===
export const getUsers = async (): Promise<User[]> => {
  await checkAuth()
  const result = await crudAPI.getUsers()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createUser = async (userData: InsertUser): Promise<User> => {
  await checkAuth()
  const result = await crudAPI.createUser(userData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateUser = async (id: number, userData: Partial<User>): Promise<User> => {
  await checkAuth()
  const result = await crudAPI.updateUser(id, userData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteUser = async (id: number): Promise<void> => {
  await checkAuth()
  const result = await crudAPI.deleteUser(id)
  if (result.error) {
    throw new Error(result.error)
  }
}

// ============= DASHBOARD STATS API =============

import { DashboardStats } from './supabase-client'

export type { DashboardStats }

export async function getDashboardStats(filters?: {
  startDate?: string;
  endDate?: string;
  previousStartDate?: string;
  previousEndDate?: string;
}): Promise<DashboardStats> {
  const token = await checkAuth()
  
  // Usar a API do servidor que tem a lógica correta para período anterior
  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const params = new URLSearchParams()
  if (filters?.startDate) params.append('startDate', filters.startDate)
  if (filters?.endDate) params.append('endDate', filters.endDate)
  if (filters?.previousStartDate) params.append('previousStartDate', filters.previousStartDate)
  if (filters?.previousEndDate) params.append('previousEndDate', filters.previousEndDate)

  const url = `${API_BASE_URL}/api/dashboard/stats${params.toString() ? '?' + params.toString() : ''}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
  }

  return await response.json()
}

// === PROJETOS ===
export const getProjects = async (): Promise<Project[]> => {
  await checkAuth()
  const result = await crudAPI.getProjects()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createProject = async (projectData: InsertProject): Promise<Project> => {
  await checkAuth()
  const result = await crudAPI.createProject(projectData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateProject = async (id: number, projectData: Partial<Project>): Promise<Project> => {
  await checkAuth()
  const result = await crudAPI.updateProject(id, projectData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteProject = async (id: number): Promise<void> => {
  await checkAuth()
  const result = await crudAPI.deleteProject(id)
  if (result.error) {
    throw new Error(result.error)
  }
}

// === DESPESAS ===
export const getExpenses = async (): Promise<Expense[]> => {
  await checkAuth()
  const result = await crudAPI.getExpenses()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createExpense = async (expenseData: InsertExpense): Promise<Expense> => {
  await checkAuth()
  const result = await crudAPI.createExpense(expenseData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateExpense = async (id: number, expenseData: Partial<Expense>): Promise<Expense> => {
  await checkAuth()
  const result = await crudAPI.updateExpense(id, expenseData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteExpense = async (id: number): Promise<void> => {
  await checkAuth()
  const result = await crudAPI.deleteExpense(id)
  if (result.error) {
    throw new Error(result.error)
  }
}



// === CÓDIGOS ===
export const getCodes = async (): Promise<Code[]> => {
  await checkAuth()
  const result = await crudAPI.getCodes()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createCode = async (codeData: InsertCode): Promise<Code> => {
  await checkAuth()
  const result = await crudAPI.createCode(codeData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateCode = async (id: number, codeData: Partial<Code>): Promise<Code> => {
  await checkAuth()
  const result = await crudAPI.updateCode(id, codeData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteCode = async (id: number): Promise<void> => {
  await checkAuth()
  const result = await crudAPI.deleteCode(id)
  if (result.error) {
    throw new Error(result.error)
  }
}