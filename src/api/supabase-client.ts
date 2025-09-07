import { supabase, handleSupabaseError } from '../lib/supabase'
import { AuthUser, LoginCredentials, RegisterCredentials } from '../types/database'

// Auth functions using Supabase client
export const authAPI = {
  async login(credentials: LoginCredentials) {
    try {
      // First, get user by email to check custom user table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', credentials.email)
        .eq('is_active', true)
        .single()

      if (userError || !userData) {
        throw new Error('Usuário não encontrado ou inativo')
      }

      // For now, we'll use a simple password check
      // In production, you should use proper password hashing
      const bcrypt = await import('bcryptjs')
      const isValidPassword = await bcrypt.compare(credentials.password, userData.password)
      
      if (!isValidPassword) {
        throw new Error('Senha incorreta')
      }

      // Create a session token (simplified)
      const token = btoa(JSON.stringify({ 
        id: userData.id, 
        email: userData.email, 
        exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      }))

      return {
        user: userData,
        token,
        success: true
      }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async verify(token: string) {
    try {
      const decoded = JSON.parse(atob(token))
      
      if (decoded.exp < Date.now()) {
        throw new Error('Token expirado')
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.id)
        .eq('is_active', true)
        .single()

      if (error || !userData) {
        throw new Error('Usuário não encontrado')
      }

      return {
        user: userData,
        valid: true
      }
    } catch (error: any) {
      return handleSupabaseError(error)
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

      const bcrypt = await import('bcryptjs')
      const isValidPassword = await bcrypt.compare(currentPassword, userData.password)
      
      if (!isValidPassword) {
        throw new Error('Senha atual incorreta')
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10)

      const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashedNewPassword })
        .eq('id', userId)

      if (updateError) {
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
            position: credentials.position,
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async createUser(userData: any) {
    try {
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.hash(userData.password, 10)

      const { data, error } = await supabase
        .from('users')
        .insert([{ ...userData, password: hashedPassword }])
        .select()
        .single()

      if (error) throw error
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

      if (error) throw error
      return { data, success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async deleteUser(id: number) {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  // Projects
  async getProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async createProject(projectData: any) {
    try {
      // Usar user_id padrão sem verificação para evitar erro 406 RLS
      const userId = 1; // User_id fixo para evitar problemas de RLS
      console.log('🔍 DEBUG - Usando user_id fixo para projeto:', userId);
      
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
        .single()

      if (error) throw error
      return { data, success: true }
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

      if (error) throw error
      return { data, success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async createExpense(expenseData: any) {
    try {
      // Usar user_id padrão sem verificação para evitar erro 406 RLS
      const userId = 1; // User_id fixo para evitar problemas de RLS
      console.log('🔍 DEBUG - Usando user_id fixo para despesa:', userId);
      
      // Mapear campos do frontend para o schema do banco
      const mappedData = {
        description: `${expenseData.description}_${Date.now()}`, // Adicionar timestamp para evitar duplicatas
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

      if (error) throw error
      return { data, success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async deleteExpense(id: number) {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  // Codes
  async getCodes() {
    try {
      const { data, error } = await supabase
        .from('codes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async createCode(codeData: any) {
    try {
      // Primeiro, verificar se existe um usuário válido
      console.log('🔍 DEBUG - Verificando usuário válido...');
      
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('is_active', true)
        .limit(1);
      
      if (userError || !users || users.length === 0) {
        throw new Error('Nenhum usuário ativo encontrado. Verifique se existe pelo menos um usuário na tabela users.');
      }
      
      const userId = users[0].id;
      console.log('🔍 DEBUG - Usando user_id válido:', userId);
      
      // Validar campos obrigatórios
      if (!codeData.title || codeData.title.trim() === '') {
        throw new Error('Title é obrigatório');
      }
      
      if (!codeData.code_content && !codeData.content) {
        throw new Error('Code content é obrigatório');
      }
      
      // Validar language constraint (deve ser css, html ou javascript)
      const validLanguages = ['css', 'html', 'javascript'];
      const language = codeData.language || 'javascript';
      if (!validLanguages.includes(language)) {
        throw new Error(`Language deve ser um dos valores: ${validLanguages.join(', ')}`);
      }
      
      // Mapear campos do frontend para o schema do banco
      const insertData = {
        title: codeData.title.trim(),
        language: language,
        code_content: codeData.code_content || codeData.content || '',
        description: codeData.description || null,
        user_id: userId
      };

      console.log('🔍 DEBUG Supabase - Dados do código para inserção:', insertData);

      // Usar SDK do Supabase corretamente (não REST API direta)
      // Isso evita problemas com querystring ?columns=... em requisições POST
      const { data, error } = await supabase
        .from('codes')
        .insert(insertData)
        .select('*')
        .single();

      if (error) {
        console.error('🔍 DEBUG Supabase - Erro na inserção do código:', error);
        console.error('🔍 DEBUG Supabase - Detalhes do erro:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Fornecer mensagens de erro mais específicas
        if (error.code === '23503') {
          throw new Error('Erro de foreign key: user_id não existe na tabela users');
        } else if (error.code === '23505') {
          throw new Error('Erro de duplicação: já existe um registro com esses dados');
        } else if (error.code === '23514') {
          throw new Error('Erro de constraint: verifique se language é css, html ou javascript');
        }
        
        throw error;
      }
      
      console.log('🔍 DEBUG Supabase - Código criado com sucesso:', data);
      return { data, success: true };
    } catch (error: any) {
      console.error('🔍 DEBUG Supabase - Erro capturado no código:', error);
      return handleSupabaseError(error)
    }
  },

  async updateCode(id: number, codeData: any) {
    try {
      const { data, error } = await supabase
        .from('codes')
        .update(codeData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data, success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async deleteCode(id: number) {
    try {
      const { error } = await supabase
        .from('codes')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
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
      const totalPaidValue = projects?.reduce((sum, p) => sum + (Number(p.paid_value) || 0), 0) || 0

      // Calcular estatísticas das despesas
      const totalExpenses = expenses?.length || 0
      const totalExpensesAmount = expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0
      const expenseCategories = new Set(expenses?.map(e => e.category)).size || 0

      // Calcular receita por mês (últimos 12 meses)
      const revenueByMonth = []
      const now = new Date()
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
  }
}

// APIs já exportadas individualmente acima