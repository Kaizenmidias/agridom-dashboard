import { crudAPI } from './supabase-client'
import { User, Project, Expense, Code, InsertUser, InsertProject, InsertExpense, InsertCode } from '../types/database'
// API_BASE_URL removido - usando apenas Supabase agora
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
    // Token malformado - apenas logar o erro, não limpar automaticamente
    console.warn('Token malformado detectado')
    throw new Error('Token inválido')
  }
  
  // Verificar se o token não está expirado (verificação básica)
  try {
    const payload = JSON.parse(atob(tokenParts[1]))
    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.warn('Token expirado detectado')
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

export const getDashboardStats = async (filters?: {
  startDate?: string;
  endDate?: string;
  previousStartDate?: string;
  previousEndDate?: string;
  targetYear?: number;
}): Promise<DashboardStats> => {
  await checkAuth()
  
  console.log('🔍 DEBUG - Buscando stats do dashboard via Supabase...');
  
  const result = await crudAPI.getDashboardStats()
  if (result.error) {
    console.error('❌ Erro ao buscar stats:', result.error);
    throw new Error(result.error)
  }
  
  console.log('✅ Stats do dashboard obtidas com sucesso:', result.data);
  return result.data
}

// === PROJETOS ===
export const getProjects = async (): Promise<Project[]> => {
  console.log('🔍 CRUD.TS - getProjects() chamada');
  await checkAuth()
  console.log('✅ Auth verificada, chamando crudAPI.getProjects()');
  const result = await crudAPI.getProjects()
  console.log('📊 Resultado crudAPI.getProjects():', result);
  if (result.error) {
    console.error('❌ Erro em getProjects:', result.error);
    throw new Error(result.error)
  }
  console.log('✅ getProjects concluída, retornando:', result.data?.length, 'projetos');
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
  console.log('🔍 CRUD.TS - getExpenses() chamada');
  await checkAuth()
  console.log('✅ Auth verificada, chamando crudAPI.getExpenses()');
  const result = await crudAPI.getExpenses()
  console.log('📊 Resultado crudAPI.getExpenses():', result);
  if (result.error) {
    console.error('❌ Erro em getExpenses:', result.error);
    throw new Error(result.error)
  }
  console.log('✅ getExpenses concluída, retornando:', result.data?.length, 'despesas');
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
  console.log('🔍 CRUD.TS - getCodes() chamada');
  await checkAuth()
  console.log('✅ Auth verificada, chamando crudAPI.getCodes()');
  const result = await crudAPI.getCodes()
  console.log('📊 Resultado crudAPI.getCodes():', result);
  if (result.error) {
    console.error('❌ Erro em getCodes:', result.error);
    throw new Error(result.error)
  }
  console.log('✅ getCodes concluída, retornando:', result.data?.length, 'códigos');
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