import { crudAPI } from './supabase-client'
import { User, Project, Expense, Code, InsertUser, InsertProject, InsertExpense, InsertCode } from '../types/database'

// Re-exportar tipos para uso em outros componentes
export type { User, Project, Expense, Code };

// Função auxiliar para verificar autenticação
const checkAuth = () => {
  const token = localStorage.getItem('authToken')
  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }
  return token
}

// === USUÁRIOS ===
export const getUsers = async (): Promise<User[]> => {
  checkAuth()
  const result = await crudAPI.getUsers()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createUser = async (userData: InsertUser): Promise<User> => {
  checkAuth()
  const result = await crudAPI.createUser(userData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateUser = async (id: number, userData: Partial<User>): Promise<User> => {
  checkAuth()
  const result = await crudAPI.updateUser(id, userData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteUser = async (id: number): Promise<void> => {
  checkAuth()
  const result = await crudAPI.deleteUser(id)
  if (result.error) {
    throw new Error(result.error)
  }
}

// ============= DASHBOARD STATS API =============

import { dashboardAPI, DashboardStats } from './supabase-client'

export type { DashboardStats }

export async function getDashboardStats(filters?: {
  startDate?: string;
  endDate?: string;
  previousStartDate?: string;
  previousEndDate?: string;
}): Promise<DashboardStats> {
  checkAuth()
  const result = await dashboardAPI.getDashboardStats(filters)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

// === PROJETOS ===
export const getProjects = async (): Promise<Project[]> => {
  checkAuth()
  const result = await crudAPI.getProjects()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createProject = async (projectData: InsertProject): Promise<Project> => {
  checkAuth()
  const result = await crudAPI.createProject(projectData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateProject = async (id: number, projectData: Partial<Project>): Promise<Project> => {
  checkAuth()
  const result = await crudAPI.updateProject(id, projectData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteProject = async (id: number): Promise<void> => {
  checkAuth()
  const result = await crudAPI.deleteProject(id)
  if (result.error) {
    throw new Error(result.error)
  }
}

// === DESPESAS ===
export const getExpenses = async (): Promise<Expense[]> => {
  checkAuth()
  const result = await crudAPI.getExpenses()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createExpense = async (expenseData: InsertExpense): Promise<Expense> => {
  checkAuth()
  const result = await crudAPI.createExpense(expenseData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateExpense = async (id: number, expenseData: Partial<Expense>): Promise<Expense> => {
  checkAuth()
  const result = await crudAPI.updateExpense(id, expenseData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteExpense = async (id: number): Promise<void> => {
  checkAuth()
  const result = await crudAPI.deleteExpense(id)
  if (result.error) {
    throw new Error(result.error)
  }
}



// === CÓDIGOS ===
export const getCodes = async (): Promise<Code[]> => {
  checkAuth()
  const result = await crudAPI.getCodes()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createCode = async (codeData: InsertCode): Promise<Code> => {
  checkAuth()
  const result = await crudAPI.createCode(codeData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateCode = async (id: number, codeData: Partial<Code>): Promise<Code> => {
  checkAuth()
  const result = await crudAPI.updateCode(id, codeData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteCode = async (id: number): Promise<void> => {
  checkAuth()
  const result = await crudAPI.deleteCode(id)
  if (result.error) {
    throw new Error(result.error)
  }
}