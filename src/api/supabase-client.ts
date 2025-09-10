import { supabase, handleSupabaseError } from '../lib/supabase'
import { AuthUser, LoginCredentials, RegisterCredentials } from '../types/database'
import { calculateMonthlyAmount } from '../utils/billing-calculations'
import { API_BASE_URL } from '../config/api'

// Auth functions using Supabase client
export const authAPI = {
  async login(credentials: LoginCredentials) {
    try {
      // Delegate authentication to backend API first
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
        })
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (jsonError) {
          console.error('Erro ao fazer parse do JSON de erro:', jsonError)
          throw new Error(`Erro no servidor: ${response.status} ${response.statusText}`)
        }
        throw new Error(errorData.error || 'Erro no login')
      }

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('Erro ao fazer parse do JSON de resposta:', jsonError)
        throw new Error('Resposta inválida do servidor')
      }
      
      return {
        user: data.user,
        token: data.token,
        success: true
      }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async verify(token: string) {
    try {
      // Verificação básica do formato do token
      if (!token || typeof token !== 'string') {
        throw new Error('Token inválido');
      }

      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Token malformado');
      }

      // Usar a API do servidor para verificar o token JWT
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (jsonError) {
          console.error('Erro ao fazer parse do JSON de erro na verificação:', jsonError)
          errorData = { error: 'Token inválido' }
        }
        throw new Error(errorData.error || 'Token inválido');
      }

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('Erro ao fazer parse do JSON de resposta na verificação:', jsonError)
        throw new Error('Resposta inválida do servidor na verificação')
      }
      
      if (data.valid && data.user) {
        return {
          user: data.user,
          valid: true
        };
      } else {
        throw new Error('Token inválido');
      }
    } catch (error: any) {
      // NÃO limpar localStorage automaticamente - deixar para o AuthContext decidir
      // Isso evita loops de redirecionamento
      console.error('Erro na verificação do token:', error);
      return {
        user: null,
        valid: false,
        error: error.message || 'Token inválido'
      }
    }
  },

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('password')
        .eq('id', userId)
        .single()

      if (userError || !userData) {
        throw new Error('Usuário não encontrado')
      }

      // Delegate password change to backend API
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          currentPassword,
          newPassword
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao alterar senha')
      }

      const data = await response.json()
      if (!data.success) {
        throw updateError
      }

      return { success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async forgotPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        throw new Error(error.message)
      }

      return { success: true, message: 'Email de recuperação enviado com sucesso!' }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async resetPassword(token: string, newPassword: string) {
    try {
      // Primeiro, verificar se a sessão é válida com o token
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: token
      })

      if (sessionError) {
        throw new Error('Token inválido ou expirado')
      }

      // Atualizar a senha
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw new Error(error.message)
      }

      return { success: true, message: 'Senha alterada com sucesso!' };
  } catch (error: any) {
    return handleSupabaseError(error);
  }
},

  async register(credentials: any) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            full_name: credentials.full_name,
            role: credentials.role,
            bio: credentials.bio || '',
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        user: data.user,
        session: data.session,
        token: data.session?.access_token,
      };
    } catch (error: any) {
      return handleSupabaseError(error);
    }
  },

  async uploadAvatar(file: File) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      return { user: { ...user, avatar_url: publicUrl } };
    } catch (error: any) {
      return handleSupabaseError(error);
    }
  },

  async updateProfile(userData: any) {
    try {
      const { error } = await supabase.auth.updateUser({
        data: userData
      });

      if (error) {
        throw new Error(error.message);
      }

      const { data: { user } } = await supabase.auth.getUser();
      return { user };
    } catch (error: any) {
      return handleSupabaseError(error);
    }
  }
}

// CRUD functions using Supabase client
export const crudAPI = {
  // Users
  async getUsers() {
    try {
      // Usar API do servidor backend que requer autenticação
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/users`, {
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

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async createUser(userData: any) {
    try {
      // Delegate user creation to backend API
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar usuário')
      }

      const data = await response.json()
      return { data: data.user, success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async updateUser(id: number, userData: any) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async deleteUser(id: number) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      return { success: true }
    } catch (error: any) {
      return { error: error.message, success: false }
    }
  },

  // Projects
  async getProjects() {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/projects`, {
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

      const result = await response.json()
      // A API retorna um array diretamente, não um objeto com propriedade 'data'
      return { data: Array.isArray(result) ? result : [], success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async createProject(projectData: any) {
    try {
      // Usar API do servidor backend que usa o user_id do token JWT
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async createProjectOld(projectData: any) {
    try {
      // Código antigo mantido como backup
      const userId = 25; // User_id válido (Ricardo) para evitar foreign key constraint
      console.log('🔍 DEBUG - Usando user_id válido para projeto:', userId);
      
      // Mapear campos do frontend para o schema do banco
      const mappedData = {
        name: projectData.name.trim(), // Usar nome exato digitado pelo usuário
        client: projectData.client || '',
        project_type: projectData.project_type || 'website',
        status: projectData.status || 'active',
        description: projectData.description || '',
        project_value: projectData.project_value || projectData.value || 0,
        paid_value: projectData.paid_value || 0,
        delivery_date: projectData.delivery_date || null,
        completion_date: projectData.completion_date || null,
        user_id: userId
      }

      console.log('🔍 DEBUG Supabase - Dados do projeto mapeados:', mappedData)

      const { data, error } = await supabase
        .from('projects')
        .insert([mappedData])

      if (error) {
        console.error('🔍 DEBUG Supabase - Erro na inserção do projeto:', error)
        throw error
      }
      
      console.log('🔍 DEBUG Supabase - Projeto criado com sucesso')
      return { data: { id: 'created' }, success: true }
    } catch (error: any) {
      console.error('🔍 DEBUG Supabase - Erro capturado no projeto:', error)
      return handleSupabaseError(error)
    }
  },

  async updateProject(id: number, projectData: any) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', id)
        .select()

      if (error) throw error
      
      // Verificar se algum registro foi atualizado
      if (!data || data.length === 0) {
        throw new Error('Projeto não encontrado ou não foi possível atualizar')
      }
      
      return { data: data[0], success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async deleteProject(id: number) {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  // Expenses
  async getExpenses() {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/expenses`, {
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

      const result = await response.json()
      // A API retorna um array diretamente, não um objeto com propriedade 'data'
      return { data: Array.isArray(result) ? result : [], success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async createExpense(expenseData: any) {
    try {
      // Usar API do servidor backend que usa o user_id do token JWT
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(expenseData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async createExpenseOld(expenseData: any) {
    try {
      // Código antigo mantido como backup
      const userId = 25; // User_id válido para evitar erro de foreign key constraint
      console.log('🔍 DEBUG - Usando user_id válido para despesa:', userId);
      
      // Mapear campos do frontend para o schema do banco
      const mappedData = {
        description: expenseData.description, // Campo description sem timestamp
        value: expenseData.amount || expenseData.value, // Mapear 'amount' para 'value'
        category: expenseData.category || 'Geral',
        date: expenseData.date || expenseData.expense_date,
        billing_type: expenseData.billing_type || 'unica',
        project_id: expenseData.project_id || null,
        user_id: userId,
        notes: expenseData.notes || ''
      }

      console.log('🔍 DEBUG Supabase - Dados mapeados para inserção:', mappedData)

      const { data, error } = await supabase
        .from('expenses')
        .insert([mappedData])
        .select()
        .single()

      if (error) {
        console.error('🔍 DEBUG Supabase - Erro na inserção:', error)
        throw error
      }
      
      console.log('🔍 DEBUG Supabase - Despesa criada com sucesso:', data)
      return { data, success: true }
    } catch (error: any) {
      console.error('🔍 DEBUG Supabase - Erro capturado:', error)
      return handleSupabaseError(error)
    }
  },

  async updateExpense(id: number, expenseData: any) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/expenses/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(expenseData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async deleteExpense(id: number) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/expenses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      return { success: true }
    } catch (error: any) {
      return { error: error.message, success: false }
    }
  },

  // Codes
  async getCodes() {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/codes`, {
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

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: [], error: error.message, success: false }
    }
  },

  async createCode(codeData: any) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/codes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(codeData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async updateCode(id: number, codeData: any) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/codes/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(codeData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async deleteCode(id: number) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/codes/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  // Dashboard stats
  async getDashboardStats() {
    try {
      // Get projects stats
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, project_value, status')

      if (projectsError) throw projectsError

      // Get expenses stats
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('id, amount')

      if (expensesError) throw expensesError

      // Get users count
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id', { count: 'exact' })

      if (usersError) throw usersError

      // Calculate stats
      const totalProjects = projectsData?.length || 0
      const totalValue = projectsData?.reduce((sum, project) => sum + (project.project_value || 0), 0) || 0
      const activeProjects = projectsData?.filter(p => p.status === 'active').length || 0
      const totalExpenses = expensesData?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0
      const totalUsers = usersData?.length || 0

      return {
        data: {
          totalProjects,
          totalValue,
          activeProjects,
          totalExpenses,
          totalUsers
        },
        success: true
      }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  }
}

// === DASHBOARD STATS ===
export interface DashboardStats {
  projects: {
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    paused_projects: number;
    total_project_value: number;
    total_paid_value: number;
  };
  expenses: {
    total_expenses: number;
    total_expenses_amount: number;
    expense_categories: number;
  };
  previous_period: {
    revenue: number;
    expenses: number;
    receivable: number;
  };
  current_period: {
    revenue: number;
    expenses: number;
    profit: number;
    receivable: number;
  };
  current_receivable: number;
  revenue_by_month: Array<{
    month: string;
    revenue: number;
  }>;
  expenses_by_category: Array<{
    category: string;
    total_amount: number;
    count: number;
  }>;
  recent_projects: Array<{
    id: string;
    name: string;
    status: string;
    project_value: number;
    created_at: string;
  }>;
}

export const dashboardAPI = {
  async getDashboardStats(filters?: {
    startDate?: string;
    endDate?: string;
    previousStartDate?: string;
    previousEndDate?: string;
  }): Promise<{ data: DashboardStats; error?: string }> {
    try {
      // Buscar projetos
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')

      if (projectsError) {
        return { data: {} as DashboardStats, error: projectsError.message }
      }

      // Buscar despesas
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('*')

      if (expensesError) {
        return { data: {} as DashboardStats, error: expensesError.message }
      }

      // Calcular estatísticas dos projetos
      const totalProjects = projects?.length || 0
      const activeProjects = projects?.filter(p => p.status === 'active').length || 0
      const completedProjects = projects?.filter(p => p.status === 'completed').length || 0
      const pausedProjects = projects?.filter(p => p.status === 'paused').length || 0
      const totalProjectValue = projects?.reduce((sum, p) => sum + (Number(p.project_value) || 0), 0) || 0
      
      // Calcular faturamento considerando filtros de data
      let totalPaidValue = 0
      
      if (filters?.startDate && filters?.endDate) {
        // Com filtros de data
        const startDate = new Date(filters.startDate)
        const endDate = new Date(filters.endDate)
        
        // Verificar se é filtro anual (janeiro a dezembro do mesmo ano)
        const isYearlyFilter = startDate.getFullYear() === endDate.getFullYear() && 
                              startDate.getMonth() === 0 && 
                              endDate.getMonth() === 11
        
        if (isYearlyFilter) {
          // Para filtro anual, calcular faturamento apenas até o mês atual
          const filterYear = startDate.getFullYear()
          const currentDate = new Date()
          const currentYear = currentDate.getFullYear()
          const currentMonth = currentDate.getMonth() + 1
          
          // Se é o ano atual, calcular apenas até o mês atual
          // Se é ano passado ou futuro, calcular todos os 12 meses
          const monthsToCalculate = filterYear === currentYear ? currentMonth : 12
          
          totalPaidValue = projects?.filter(p => {
            const createdAt = new Date(p.created_at)
            const projectYear = createdAt.getFullYear()
            const projectMonth = createdAt.getMonth() + 1
            
            return projectYear === filterYear && projectMonth <= monthsToCalculate
          }).reduce((sum, p) => sum + (Number(p.paid_value) || 0), 0) || 0
        } else {
          // Para filtro mensal, calcular apenas o mês específico
          const year = startDate.getFullYear()
          const month = startDate.getMonth() + 1
          
          totalPaidValue = projects?.filter(p => {
            const createdAt = new Date(p.created_at)
            return createdAt.getFullYear() === year && 
                   (createdAt.getMonth() + 1) === month
          }).reduce((sum, p) => sum + (Number(p.paid_value) || 0), 0) || 0
        }
      } else {
        // Sem filtros - usar todos os projetos
        totalPaidValue = projects?.reduce((sum, p) => sum + (Number(p.paid_value) || 0), 0) || 0
      }

      // Calcular estatísticas das despesas
      const totalExpenses = expenses?.length || 0
      const now = new Date()
      
      // Calcular valor total das despesas considerando recorrência e filtros
      let totalExpensesAmount = 0
      
      if (filters?.startDate && filters?.endDate) {
        // Com filtros de data
        const startDate = new Date(filters.startDate)
        const endDate = new Date(filters.endDate)
        
        // Verificar se é filtro anual (janeiro a dezembro do mesmo ano)
        const isYearlyFilter = startDate.getFullYear() === endDate.getFullYear() && 
                              startDate.getMonth() === 0 && 
                              endDate.getMonth() === 11
        
        if (isYearlyFilter) {
          // Para filtro anual, calcular despesas para o ano do filtro
          const filterYear = startDate.getFullYear()
          const currentDate = new Date()
          const currentYear = currentDate.getFullYear()
          const currentMonth = currentDate.getMonth() + 1
          
          // Se é o ano atual, calcular apenas até o mês atual
          // Se é ano passado ou futuro, calcular todos os 12 meses
          const monthsToCalculate = filterYear === currentYear ? currentMonth : 12
          
          for (let month = 1; month <= monthsToCalculate; month++) {
              const monthlyTotal = expenses?.reduce((acc, expense) => {
                const monthlyAmount = calculateMonthlyAmount(
                  Number(expense.value || expense.amount) || 0,
                  expense.billing_type || 'unica',
                  expense.date,
                  filterYear,
                  month
                )
                return acc + (Number(monthlyAmount) || 0)
              }, 0) || 0
              
              totalExpensesAmount += monthlyTotal
            }
        } else {
          // Para filtro mensal, calcular apenas o mês específico
          const year = startDate.getFullYear()
          const month = startDate.getMonth() + 1
          
          totalExpensesAmount = expenses?.reduce((acc, expense) => {
            const monthlyAmount = calculateMonthlyAmount(
              Number(expense.value || expense.amount) || 0,
              expense.billing_type || 'unica',
              expense.date,
              year,
              month
            )
            return acc + (Number(monthlyAmount) || 0)
          }, 0) || 0
        }
      } else {
        // Sem filtros - usar mês atual
        totalExpensesAmount = expenses?.reduce((acc, expense) => {
          const billingType = expense.billing_type || 'unica'
          
          // Para despesas únicas, usa valor direto
          if (billingType === 'unica' || billingType === 'one_time') {
            return acc + (Number(expense.value || expense.amount) || 0)
          }
          
          // Para despesas recorrentes, calcula valor mensal
          const monthlyAmount = calculateMonthlyAmount(
            Number(expense.value || expense.amount) || 0,
            billingType,
            expense.date,
            now.getFullYear(),
            now.getMonth() + 1
          )
          
          return acc + (Number(monthlyAmount) || 0)
        }, 0) || 0
      }
      
      const expenseCategories = new Set(expenses?.map(e => e.category)).size || 0

      // Calcular receita por mês (últimos 12 meses)
      const revenueByMonth = []
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        const monthlyRevenue = projects?.filter(p => {
          const createdAt = new Date(p.created_at)
          return createdAt.getFullYear() === date.getFullYear() && 
                 createdAt.getMonth() === date.getMonth()
        }).reduce((sum, p) => sum + (Number(p.paid_value) || 0), 0) || 0
        
        revenueByMonth.push({
          month: monthStr,
          revenue: monthlyRevenue
        })
      }

      // Despesas por categoria
      const expensesByCategory = expenses?.reduce((acc, expense) => {
        const category = expense.category || 'Outros'
        if (!acc[category]) {
          acc[category] = { total_amount: 0, count: 0 }
        }
        acc[category].total_amount += Number(expense.amount) || 0
        acc[category].count += 1
        return acc
      }, {} as Record<string, { total_amount: number; count: number }>) || {}

      const expensesByCategoryArray = Object.entries(expensesByCategory).map(([category, data]) => ({
        category,
        total_amount: data.total_amount,
        count: data.count
      }))

      // Projetos recentes (últimos 5)
      const recentProjects = projects?.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 5).map(p => ({
        id: String(p.id),
        name: p.name,
        status: p.status,
        project_value: Number(p.project_value) || 0,
        created_at: p.created_at
      })) || []

      // Calcular período atual e anterior
      const currentRevenue = totalPaidValue
      const currentExpenses = totalExpensesAmount
      const currentProfit = currentRevenue - currentExpenses
      const currentReceivable = totalProjectValue - totalPaidValue

      const dashboardStats: DashboardStats = {
        projects: {
          total_projects: totalProjects,
          active_projects: activeProjects,
          completed_projects: completedProjects,
          paused_projects: pausedProjects,
          total_project_value: totalProjectValue,
          total_paid_value: totalPaidValue
        },
        expenses: {
          total_expenses: totalExpenses,
          total_expenses_amount: totalExpensesAmount,
          expense_categories: expenseCategories
        },
        previous_period: {
          revenue: 0, // Seria necessário implementar lógica de período anterior
          expenses: 0,
          receivable: 0
        },
        current_period: {
          revenue: currentRevenue,
          expenses: currentExpenses,
          profit: currentProfit,
          receivable: currentReceivable
        },
        current_receivable: currentReceivable,
        revenue_by_month: revenueByMonth,
        expenses_by_category: expensesByCategoryArray,
        recent_projects: recentProjects
      }

      return { data: dashboardStats }
    } catch (error) {
      console.error('Erro ao buscar estatísticas do dashboard:', error)
      return { data: {} as DashboardStats, error: 'Erro ao buscar estatísticas do dashboard' }
    }
  },

  // Briefings
  async getBriefings(filters?: { search?: string; status?: string; priority?: string }) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const params = new URLSearchParams()
      if (filters?.search) params.append('search', filters.search)
      if (filters?.status) params.append('status', filters.status)
      if (filters?.priority) params.append('priority', filters.priority)

      const url = `${API_BASE_URL}/api/briefings${params.toString() ? '?' + params.toString() : ''}`
      
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

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: [], error: error.message, success: false }
    }
  },

  async getBriefing(id: string) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/briefings/${id}`, {
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

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async createBriefing(briefingData: any) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/briefings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(briefingData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async updateBriefing(id: string, briefingData: any) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/briefings/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(briefingData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async deleteBriefing(id: string) {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${API_BASE_URL}/api/briefings/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`)
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

// APIs já exportadas individualmente acima