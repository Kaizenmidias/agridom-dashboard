import { crudAPI } from './supabase-client'
import { User, Project, Expense, Code, InsertUser, InsertProject, InsertExpense, InsertCode, CompanyAccess, InsertCompanyAccess, Briefing, InsertBriefing } from '../types/database'
// API_BASE_URL removido - usando apenas Supabase agora
import { verifyToken } from './auth'

// Re-exportar tipos para uso em outros componentes
export type { User, Project, Expense, Code, CompanyAccess, Briefing };

// Função auxiliar para verificar autenticação usando Supabase
const checkAuth = async () => {
  try {
    const { supabase } = await import('../lib/supabase')
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Erro ao obter sessão:', error.message)
      throw new Error('Erro de autenticação: ' + error.message)
    }
    
    if (!session || !session.user) {
      console.warn('Nenhuma sessão ativa encontrada')
      throw new Error('Auth session missing!')
    }
    
    return session.user
  } catch (error: any) {
    console.error('Erro na verificação de autenticação:', error.message)
    throw new Error('Auth session missing!')
  }
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

// === ACESSOS DE EMPRESAS ===
export const getCompanyAccesses = async (): Promise<CompanyAccess[]> => {
  await checkAuth()
  const result = await crudAPI.getCompanyAccess()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createCompanyAccess = async (accessData: InsertCompanyAccess): Promise<CompanyAccess> => {
  await checkAuth()
  const result = await crudAPI.createCompanyAccess(accessData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateCompanyAccess = async (id: number, accessData: Partial<CompanyAccess>): Promise<CompanyAccess> => {
  await checkAuth()
  const result = await crudAPI.updateCompanyAccess(id, accessData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteCompanyAccess = async (id: number): Promise<void> => {
  await checkAuth()
  const result = await crudAPI.deleteCompanyAccess(id)
  if (result.error) {
    throw new Error(result.error)
  }
}

// === BRIEFINGS ===
export const getBriefings = async (): Promise<Briefing[]> => {
  await checkAuth()
  const result = await crudAPI.getBriefings()
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const createBriefing = async (briefingData: InsertBriefing): Promise<Briefing> => {
  await checkAuth()
  const result = await crudAPI.createBriefing(briefingData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const updateBriefing = async (id: string, briefingData: Partial<Briefing>): Promise<Briefing> => {
  await checkAuth()
  const result = await crudAPI.updateBriefing(id, briefingData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteBriefing = async (id: string): Promise<void> => {
  await checkAuth()
  const result = await crudAPI.deleteBriefing(id)
  if (result.error) {
    throw new Error(result.error)
  }
}

// ============= DASHBOARD STATS API =============

// Dashboard stats are now handled directly by dashboardAPI

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

export const updateProject = async (id: string, projectData: Partial<Project>): Promise<Project> => {
  await checkAuth()
  const result = await crudAPI.updateProject(id, projectData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteProject = async (id: string): Promise<void> => {
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

export const updateExpense = async (id: string, expenseData: Partial<Expense>): Promise<Expense> => {
  await checkAuth()
  const result = await crudAPI.updateExpense(id, expenseData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteExpense = async (id: string): Promise<void> => {
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

export const updateCode = async (id: string, codeData: Partial<Code>): Promise<Code> => {
  await checkAuth()
  const result = await crudAPI.updateCode(id, codeData)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.data
}

export const deleteCode = async (id: string): Promise<void> => {
  await checkAuth()
  const result = await crudAPI.deleteCode(id)
  if (result.error) {
    throw new Error(result.error)
  }
}