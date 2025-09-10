import { supabase, handleSupabaseError } from '../lib/supabase'
import { AuthUser, LoginCredentials, RegisterCredentials } from '../types/database'
import { calculateMonthlyAmount } from '../utils/billing-calculations'

// Auth functions using Supabase client
export const authAPI = {
  async login(credentials: LoginCredentials) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        user: data.user,
        session: data.session,
        success: true
      }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async verify(token?: string) {
    try {
      // Se um token foi fornecido, verificar se é válido
      if (token) {
        // Para tokens JWT customizados, verificar se ainda são válidos
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          const now = Date.now() / 1000
          if (payload.exp && payload.exp < now) {
            throw new Error('Token expirado')
          }
        } catch {
          throw new Error('Token inválido')
        }
      }

      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        throw new Error(error.message)
      }

      return {
        user,
        valid: !!user
      }
    } catch (error: any) {
      console.error('Erro na verificação do usuário:', error)
      return {
        user: null,
        valid: false,
        error: error.message || 'Usuário não autenticado'
      }
    }
  },

  async changePassword(newPassword: string) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw new Error(error.message)
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

  async resetPassword(newPassword: string) {
    try {
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

  async register(credentials: RegisterCredentials) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            name: credentials.name
          }
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        user: data.user,
        session: data.session,
        success: true
      }
    } catch (error: any) {
      console.error('Erro no registro:', error)
      throw error
    }
  },

  async logout() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      return { success: true }
    } catch (error: any) {
      console.error('Erro no logout:', error)
      throw error
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return { data: data || [], success: true }
    } catch (error: any) {
      return { data: [], error: error.message, success: false }
    }
  },

  async createUser(userData: any) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single()

      if (error) {
        throw error
      }

      return { data, success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async updateUser(id: number, userData: any) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw error
      }

      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async deleteUser(id: number) {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      return { error: error.message, success: false }
    }
  },

  // Projects
  async getProjects() {
    console.log('🔍 SUPABASE-CLIENT - getProjects() iniciada');
    console.log('🔗 Supabase URL:', supabase.supabaseUrl);
    try {
      console.log('📡 Fazendo chamada: supabase.from("projects").select("*")');
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      console.log('📊 Resposta Supabase - data:', data?.length, 'error:', error);
      
      if (error) {
        console.error('❌ Erro ao buscar projetos:', error)
        throw error
      }

      console.log('✅ getProjects Supabase concluída com sucesso');
      return { data: data || [], success: true }
    } catch (error: any) {
      console.error('❌ Erro inesperado ao buscar projetos:', error)
      return handleSupabaseError(error)
    }
  },

  async createProject(projectData: any) {
    try {
      // Obter o usuário autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar o ID integer do usuário na tabela users usando o email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (userError || !userData) {
        throw new Error('Usuário não encontrado na tabela users');
      }

      // Adicionar user_id aos dados do projeto (usando o ID integer da tabela users)
      const projectWithUserId = {
        ...projectData,
        user_id: projectData.user_id || userData.id
      };

      const { data, error } = await supabase
        .from('projects')
        .insert([projectWithUserId])
        .select()
        .single()

      if (error) {
        throw error
      }

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
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return { data: data || [], success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async createExpense(expenseData: any) {
    try {
      // Obter o usuário autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar o ID integer do usuário na tabela users usando o email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (userError || !userData) {
        throw new Error('Usuário não encontrado na tabela users');
      }

      // Adicionar user_id aos dados da despesa (usando o ID integer da tabela users)
      const expenseWithUserId = {
        ...expenseData,
        user_id: expenseData.user_id || userData.id
      };

      const { data, error } = await supabase
        .from('expenses')
        .insert([expenseWithUserId])
        .select()
        .single()

      if (error) {
        throw error
      }

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
      const { data, error } = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw error
      }

      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async deleteExpense(id: number) {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      return { error: error.message, success: false }
    }
  },

  // Codes
  async getCodes() {
    try {
      // Verificar se o usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('codes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return { data: data || [], success: true }
    } catch (error: any) {
      return { data: [], error: error.message, success: false }
    }
  },

  async createCode(codeData: any) {
    try {
      // Obter o usuário autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar o ID integer do usuário na tabela users usando o email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (userError || !userData) {
        throw new Error('Usuário não encontrado na tabela users');
      }

      // Adicionar user_id aos dados do código (usando o ID integer da tabela users)
      const codeWithUserId = {
        ...codeData,
        user_id: userData.id
      };

      const { data, error } = await supabase
        .from('codes')
        .insert([codeWithUserId])
        .select()
        .single()

      if (error) {
        throw error
      }

      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async updateCode(id: number, codeData: any) {
    try {
      // Verificar se o usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('codes')
        .update(codeData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw error
      }

      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async deleteCode(id: number) {
    try {
      // Verificar se o usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('codes')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
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
        .select('id, value')

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
      const totalExpenses = expensesData?.reduce((sum, expense) => sum + (expense.value || 0), 0) || 0
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
                  Number(expense.value) || 0,
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
              Number(expense.value) || 0,
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
            return acc + (Number(expense.value) || 0)
          }
          
          // Para despesas recorrentes, calcula valor mensal
          const monthlyAmount = calculateMonthlyAmount(
            Number(expense.value) || 0,
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
        acc[category].total_amount += Number(expense.value) || 0
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


}

// APIs já exportadas individualmente acima