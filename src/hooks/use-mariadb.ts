import { useState, useEffect, useCallback } from 'react'
import {
  getUsers, getUserById, createUser, updateUser, deleteUser,
  getProjects, getProjectById, createProject, updateProject, deleteProject,
  getExpenses, getExpenseById, createExpense, updateExpense, deleteExpense
} from '../api/crud'
import { User, Project, Expense } from '../types/database'
import { query } from '../lib/mariadb'



// Hooks específicos para cada tabela

// Hook para usuários
export function useUsers() {
  const [data, setData] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const users = await getUsers()
      setData(users)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar usuários')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return { data, loading, error, refetch: fetchUsers }
}

export function useUser(id: string) {
  const [data, setData] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true)
        const user = await getUserById(id)
        setData(user)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar usuário')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchUser()
    }
  }, [id])

  return { data, loading, error }
}

export function useCreateUser() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (userData: Omit<User, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true)
      setError(null)
      const newUser = await createUser(userData)
      return newUser
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar usuário'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { create, loading, error }
}

export function useUpdateUser() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = async (id: string, userData: Partial<User>) => {
    try {
      setLoading(true)
      setError(null)
      const updatedUser = await updateUser(id, userData)
      return updatedUser
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar usuário'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { update, loading, error }
}

export function useDeleteUser() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const success = await deleteUser(id)
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar usuário'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { remove, loading, error }
}

// Hook para projetos
export function useProjects(filters?: { user_id?: string; status?: string }) {
  const [data, setData] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true)
        const projects = await getProjects(filters)
        setData(projects)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar projetos')
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [filters])

  return { data, loading, error, refetch: () => window.location.reload() }
}

export function useProject(id: string) {
  const [data, setData] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true)
        const project = await getProjectById(id)
        setData(project)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar projeto')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchProject()
    }
  }, [id])

  return { data, loading, error }
}

export function useCreateProject() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true)
      setError(null)
      const newProject = await createProject(projectData)
      return newProject
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar projeto'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { create, loading, error }
}

export function useUpdateProject() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = async (id: string, projectData: Partial<Project>) => {
    try {
      setLoading(true)
      setError(null)
      const updatedProject = await updateProject(id, projectData)
      return updatedProject
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar projeto'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { update, loading, error }
}

export function useDeleteProject() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const success = await deleteProject(id)
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar projeto'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { remove, loading, error }
}

// Hook para despesas
export function useExpenses(filters?: { project_id?: string; category?: string }) {
  const [data, setData] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true)
        const expenses = await getExpenses(filters)
        setData(expenses)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar despesas')
      } finally {
        setLoading(false)
      }
    }

    fetchExpenses()
  }, [filters])

  return { data, loading, error, refetch: () => window.location.reload() }
}

export function useExpense(id: string) {
  const [data, setData] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchExpense = async () => {
      try {
        setLoading(true)
        const expense = await getExpenseById(id)
        setData(expense)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar despesa')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchExpense()
    }
  }, [id])

  return { data, loading, error }
}

export function useCreateExpense() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true)
      setError(null)
      const newExpense = await createExpense(expenseData)
      return newExpense
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar despesa'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { create, loading, error }
}

export function useUpdateExpense() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = async (id: string, expenseData: Partial<Expense>) => {
    try {
      setLoading(true)
      setError(null)
      const updatedExpense = await updateExpense(id, expenseData)
      return updatedExpense
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar despesa'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { update, loading, error }
}

export function useDeleteExpense() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const success = await deleteExpense(id)
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar despesa'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { remove, loading, error }
}



// Hook para estatísticas
export function useStatistics(userId: string) {
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalExpenses: 0,
    totalParcels: 0,
    totalCrops: 0,
    activeCrops: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const queries = [
          'SELECT COUNT(*) as count FROM projects WHERE user_id = ?',
          'SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND status = \'active\'',
          'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?'
        ]
        
        const results = await Promise.all(
          queries.map(sql => query(sql, [userId]))
        )
        
        setStats({
          totalProjects: parseInt(results[0].rows[0].count),
          activeProjects: parseInt(results[1].rows[0].count),
          totalExpenses: parseFloat(results[2].rows[0].total),
          totalParcels: 0,
          totalCrops: 0,
          activeCrops: 0
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchStats()
    }
  }, [userId])

  return { stats, loading, error }
}