import { LoginCredentials, RegisterCredentials } from '../types/database'

const normalizeBackendOrigin = (value: string) => value.replace(/\/api\/?$/, '').replace(/\/+$/, '')

const getBaseUrl = () => {
  if (import.meta.env.PROD) {
    return normalizeBackendOrigin(import.meta.env.VITE_API_BASE_URL || window.location.origin)
  }

  return 'http://localhost:3001'
}

const getStoredToken = () => localStorage.getItem('token')

const requestJson = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = getStoredToken()
  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Erro HTTP ${response.status}`)
  }

  return payload as T
}

const toResult = async <T>(fn: () => Promise<T>, fallbackData?: unknown) => {
  try {
    const data = await fn()
    return { data, success: true }
  } catch (error: any) {
    return { data: fallbackData, success: false, error: error.message }
  }
}

export const authAPI = {
  async login(credentials: LoginCredentials) {
    try {
      return await requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async verify(token?: string) {
    try {
      return await requestJson('/api/auth/verify', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
    } catch (error: any) {
      return { user: null, valid: false, error: error.message || 'Usuário nao autenticado' }
    }
  },

  async changePassword(_userId: string | number, currentPassword: string, newPassword: string) {
    try {
      await requestJson('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async forgotPassword(email: string) {
    try {
      const result = await requestJson('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      return { success: true, ...result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async resetPassword(token: string, newPassword: string) {
    try {
      const result = await requestJson('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
      return { success: true, ...result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async register(credentials: RegisterCredentials) {
    try {
      return await requestJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user_data')
    return { success: true }
  },

  async uploadAvatar(file: File) {
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const token = getStoredToken()
      const response = await fetch(`${getBaseUrl()}/api/upload/avatar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Erro ao enviar avatar')
      return { success: true, user: payload }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async updateProfile(userData: any) {
    try {
      const user = await requestJson('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(userData),
      })
      return { success: true, user }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },
}

export const crudAPI = {
  getUsers: () => toResult(() => requestJson('/api/users'), []),
  createUser: (data: any) => toResult(() => requestJson('/api/users', { method: 'POST', body: JSON.stringify(data) })),
  updateUser: (id: number | string, data: any) => toResult(() => requestJson(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })),
  deleteUser: (id: number | string) => toResult(() => requestJson(`/api/users/${id}`, { method: 'DELETE' })),

  getProjects: () => toResult(() => requestJson('/api/projects'), []),
  createProject: (data: any) => toResult(() => requestJson('/api/projects', { method: 'POST', body: JSON.stringify(data) })),
  updateProject: (id: number | string, data: any) => toResult(() => requestJson(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })),
  deleteProject: (id: number | string) => toResult(() => requestJson(`/api/projects/${id}`, { method: 'DELETE' })),

  getExpenses: () => toResult(() => requestJson('/api/expenses'), []),
  createExpense: (data: any) => toResult(() => requestJson('/api/expenses', { method: 'POST', body: JSON.stringify(data) })),
  updateExpense: (id: number | string, data: any) => toResult(() => requestJson(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) })),
  deleteExpense: (id: number | string) => toResult(() => requestJson(`/api/expenses/${id}`, { method: 'DELETE' })),

  getCodes: () => toResult(() => requestJson('/api/codes'), []),
  createCode: (data: any) => toResult(() => requestJson('/api/codes', { method: 'POST', body: JSON.stringify(data) })),
  updateCode: (id: number | string, data: any) => toResult(() => requestJson(`/api/codes/${id}`, { method: 'PUT', body: JSON.stringify(data) })),
  deleteCode: (id: number | string) => toResult(() => requestJson(`/api/codes/${id}`, { method: 'DELETE' })),

  getBriefings: () => toResult(() => requestJson('/api/briefings'), []),
  createBriefing: (data: any) => toResult(() => requestJson('/api/briefings', { method: 'POST', body: JSON.stringify(data) })),
  updateBriefing: (id: number | string, data: any) => toResult(() => requestJson(`/api/briefings/${id}`, { method: 'PUT', body: JSON.stringify(data) })),
  deleteBriefing: (id: number | string) => toResult(() => requestJson(`/api/briefings/${id}`, { method: 'DELETE' })),

  getCompanyAccess: () => toResult(() => requestJson('/api/company-access'), []),
  createCompanyAccess: (data: any) => toResult(() => requestJson('/api/company-access', { method: 'POST', body: JSON.stringify(data) })),
  updateCompanyAccess: (id: number | string, data: any) => toResult(() => requestJson(`/api/company-access/${id}`, { method: 'PUT', body: JSON.stringify(data) })),
  deleteCompanyAccess: (id: number | string) => toResult(() => requestJson(`/api/company-access/${id}`, { method: 'DELETE' })),
}

export interface DashboardStats {
  projects: {
    total_projects: number
    active_projects: number
    completed_projects: number
    paused_projects: number
    total_project_value: number
    total_paid_value: number
  }
  expenses: {
    total_expenses: number
    total_expenses_amount: number
    expense_categories: number
  }
  previous_period: {
    revenue: number
    expenses: number
    receivable: number
  }
  current_period: {
    revenue: number
    expenses: number
    profit: number
    receivable: number
  }
  current_receivable: number
  revenue_by_month: Array<{ month: string; revenue: number; expenses?: number }>
  expenses_by_category: Array<{ category: string; total_amount: number; count: number }>
  recent_projects: Array<{ id: string; name: string; status: string; project_value: number; created_at: string }>
}

export const dashboardAPI = {
  async getBackendDashboardStats(filters?: Record<string, string | number | undefined>): Promise<{ data: DashboardStats; error?: string }> {
    try {
      const params = new URLSearchParams()
      Object.entries(filters || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
      })
      const query = params.toString() ? `?${params.toString()}` : ''
      const data = await requestJson<DashboardStats>(`/api/dashboard/stats${query}`)
      return { data }
    } catch (error: any) {
      return { data: buildEmptyDashboardStats(), error: error.message }
    }
  },

  async getDashboardStats(filters?: Record<string, string | number | undefined>) {
    return this.getBackendDashboardStats(filters)
  },
}

const buildEmptyDashboardStats = (): DashboardStats => ({
  projects: {
    total_projects: 0,
    active_projects: 0,
    completed_projects: 0,
    paused_projects: 0,
    total_project_value: 0,
    total_paid_value: 0,
  },
  expenses: {
    total_expenses: 0,
    total_expenses_amount: 0,
    expense_categories: 0,
  },
  previous_period: {
    revenue: 0,
    expenses: 0,
    receivable: 0,
  },
  current_period: {
    revenue: 0,
    expenses: 0,
    profit: 0,
    receivable: 0,
  },
  current_receivable: 0,
  revenue_by_month: [],
  expenses_by_category: [],
  recent_projects: [],
})
