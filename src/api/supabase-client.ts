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
  // Users - usando backend Node.js
  async getUsers() {
    try {
      // Obter o token de sessão do Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        return { data: [], error: 'Usuário não autenticado', success: false };
      }

      const baseUrl = import.meta.env.PROD
        ? (import.meta.env.VITE_API_URL || 'https://agridom-dashboard.vercel.app')
        : 'http://localhost:3001';
      
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/users`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error: any) {
        throw error;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText || `HTTP error! status: ${response.status}, message: resposta vazia do servidor`
        );
      }

      const data = await response.json();
      return { data: data || [], success: true };
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
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
      console.log('🔍 DEBUG Supabase - Erro capturado no projeto:', error)
      return handleSupabaseError(error)
    }
  },

  // Company Access
  async getCompanyAccess() {
    try {
      const { data, error } = await supabase
        .from('company_access')
        .select('*')
        .order('company_name', { ascending: true })

      if (error) {
        throw error
      }

      return { data: data || [], success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async createCompanyAccess(accessData: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      const accessWithUserId = {
        ...accessData,
        user_id: userData?.id || 25 // Fallback to Ricardo's ID if not found
      };

      const { data, error } = await supabase
        .from('company_access')
        .insert([accessWithUserId])
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

  async updateCompanyAccess(id: number, accessData: any) {
    try {
      const { data, error } = await supabase
        .from('company_access')
        .update(accessData)
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

  async deleteCompanyAccess(id: number) {
    try {
      const { error } = await supabase
        .from('company_access')
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

  async updateProject(id: string, projectData: any) {
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

  async deleteProject(id: string) {
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

  async updateExpense(id: string, expenseData: any) {
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

  async deleteExpense(id: string) {
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

  async updateCode(id: string, codeData: any) {
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

  async deleteCode(id: string) {
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

  // Briefings
  async getBriefings() {
    try {
      const { data, error } = await supabase
        .from('briefings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Mapear campos para compatibilidade se necessário
      const mappedData = data?.map((b: any) => ({
        ...b,
        title: b.title ?? b.subject ?? '',
        content: b.content ?? b.description ?? b.message ?? '',
        subject: b.subject ?? undefined,
        client_name: b.client_name ?? b.client ?? undefined,
        client: b.client || b.client_name,
        project_type: b.project_type ?? undefined,
        status: b.status ?? 'new',
        priority: b.priority ?? 'medium'
      }))

      return { data: mappedData || [], success: true }
    } catch (error: any) {
      return handleSupabaseError(error)
    }
  },

  async createBriefing(briefingData: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single()

      const briefingWithUserId = {
        ...briefingData,
        user_id: briefingData.user_id || userData?.id
      }

      const { data, error } = await supabase
        .from('briefings')
        .insert([briefingWithUserId])
        .select()
        .single()

      if (error) throw error
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async updateBriefing(id: string, briefingData: any) {
    try {
      const { data, error } = await supabase
        .from('briefings')
        .update(briefingData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data, success: true }
    } catch (error: any) {
      return { data: null, error: error.message, success: false }
    }
  },

  async deleteBriefing(id: string) {
    try {
      const { error } = await supabase
        .from('briefings')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error: any) {
      return { error: error.message, success: false }
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
    expenses?: number;
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

const normalizeBillingType = (billingType?: string): 'unica' | 'semanal' | 'mensal' | 'anual' => {
  switch ((billingType || '').toLowerCase()) {
    case 'weekly':
    case 'semanal':
      return 'semanal'
    case 'monthly':
    case 'mensal':
      return 'mensal'
    case 'yearly':
    case 'annual':
    case 'anual':
      return 'anual'
    case 'one_time':
    case 'single':
    case 'unica':
    default:
      return 'unica'
  }
}

const getExpenseAmountValue = (expense: any): number => Number(expense?.amount ?? expense?.value ?? 0) || 0

const getProjectReferenceDate = (project: any): string =>
  project?.start_date || project?.delivery_date || project?.end_date || project?.completion_date || project?.created_at || ''

const isDateWithinRange = (value: string | undefined, startDate?: string, endDate?: string) => {
  if (!value) return false
  const dateOnly = value.slice(0, 10)
  if (startDate && dateOnly < startDate) return false
  if (endDate && dateOnly > endDate) return false
  return true
}

const getMonthKeysBetweenDates = (startDate?: string, endDate?: string): Array<{ year: number; month: number }> => {
  if (!startDate || !endDate) {
    const now = new Date()
    return [{ year: now.getFullYear(), month: now.getMonth() + 1 }]
  }

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const months: Array<{ year: number; month: number }> = []

  while (cursor <= end) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}

const calculateExpenseTotalForRange = (expense: any, startDate?: string, endDate?: string) => {
  const amount = getExpenseAmountValue(expense)
  const billingType = normalizeBillingType(expense?.billing_type)
  const date = expense?.date || expense?.expense_date || expense?.created_at || ''

  return getMonthKeysBetweenDates(startDate, endDate).reduce((sum, { year, month }) => {
    return sum + calculateMonthlyAmount(amount, billingType, date, year, month)
  }, 0)
}

const buildEmptyDashboardStats = (): DashboardStats => ({
  projects: {
    total_projects: 0,
    active_projects: 0,
    completed_projects: 0,
    paused_projects: 0,
    total_project_value: 0,
    total_paid_value: 0
  },
  expenses: {
    total_expenses: 0,
    total_expenses_amount: 0,
    expense_categories: 0
  },
  previous_period: {
    revenue: 0,
    expenses: 0,
    receivable: 0
  },
  current_period: {
    revenue: 0,
    expenses: 0,
    profit: 0,
    receivable: 0
  },
  current_receivable: 0,
  revenue_by_month: [],
  expenses_by_category: [],
  recent_projects: []
})

export const dashboardAPI = {
  // Nova função que chama a API do backend Node.js com a lógica correta
  async getBackendDashboardStats(filters?: {
    startDate?: string;
    endDate?: string;
    previousStartDate?: string;
    previousEndDate?: string;
    targetYear?: number;
    period?: string;
    year?: number;
    month?: number;
  }): Promise<{ data: DashboardStats; error?: string }> {
    try {
      // Obter o token de sessão do Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        return { data: {} as DashboardStats, error: 'Usuário não autenticado' };
      }

      const baseUrl = import.meta.env.PROD
        ? (import.meta.env.VITE_API_URL || 'https://agridom-dashboard.vercel.app')
        : 'http://localhost:3001';
      
      // Construir URL com parâmetros de filtro
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.previousStartDate) params.append('previousStartDate', filters.previousStartDate);
      if (filters?.previousEndDate) params.append('previousEndDate', filters.previousEndDate);
      if (filters?.targetYear) params.append('targetYear', filters.targetYear.toString());
      if (filters?.period) params.append('period', filters.period);
      if (filters?.year) params.append('year', filters.year.toString());
      if (filters?.month) params.append('month', filters.month.toString());
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const candidateUrls = [
        `${baseUrl}/api/dashboard-stats${queryString}`,
        `${baseUrl}/api/dashboard/stats${queryString}`,
      ];
      // #region debug-point A:dashboard-request-start
      fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"dashboard-stats-404",runId:"pre-fix",hypothesisId:"A",location:"src/api/supabase-client.ts:getBackendDashboardStats:start",msg:"[DEBUG] Iniciando busca de estatisticas da dashboard",data:{candidateUrls,filters:filters||null},ts:Date.now()})}).catch(()=>{});
      // #endregion

      let response: Response | null = null;
      let lastStatus: number | null = null;
      let lastError: unknown = null;

      for (const url of candidateUrls) {
        console.log('Frontend - Chamando API do backend:', url);
        // #region debug-point B:dashboard-request-attempt
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"dashboard-stats-404",runId:"pre-fix",hypothesisId:"B",location:"src/api/supabase-client.ts:getBackendDashboardStats:attempt",msg:"[DEBUG] Tentando endpoint da dashboard",data:{url},ts:Date.now()})}).catch(()=>{});
        // #endregion

        try {
          const attempt = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (attempt.ok) {
            response = attempt;
            // #region debug-point C:dashboard-request-success
            fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"dashboard-stats-404",runId:"pre-fix",hypothesisId:"C",location:"src/api/supabase-client.ts:getBackendDashboardStats:success",msg:"[DEBUG] Endpoint da dashboard respondeu com sucesso",data:{url,status:attempt.status},ts:Date.now()})}).catch(()=>{});
            // #endregion
            break;
          }

          lastStatus = attempt.status;
          // #region debug-point D:dashboard-request-non-ok
          fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"dashboard-stats-404",runId:"pre-fix",hypothesisId:"D",location:"src/api/supabase-client.ts:getBackendDashboardStats:non-ok",msg:"[DEBUG] Endpoint da dashboard respondeu sem sucesso",data:{url,status:attempt.status},ts:Date.now()})}).catch(()=>{});
          // #endregion

          if (attempt.status !== 404) {
            response = attempt;
            break;
          }
        } catch (error: any) {
          lastError = error;
          // #region debug-point E:dashboard-request-error
          fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"dashboard-stats-404",runId:"pre-fix",hypothesisId:"E",location:"src/api/supabase-client.ts:getBackendDashboardStats:catch",msg:"[DEBUG] Falha de rede ao consultar estatisticas da dashboard",data:{url,error:error?.message||String(error)},ts:Date.now()})}).catch(()=>{});
          // #endregion
        }
      }

      if (!response || !response.ok) {
        // #region debug-point D:dashboard-fallback-direct-supabase
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"dashboard-stats-404",runId:"post-fix",hypothesisId:"D",location:"src/api/supabase-client.ts:getBackendDashboardStats:fallback",msg:"[DEBUG] Fallback para consulta direta no Supabase apos falha da API da dashboard",data:{lastStatus,lastError:lastError instanceof Error?lastError.message:String(lastError||''),usedBackendResponse:Boolean(response)},ts:Date.now()})}).catch(()=>{});
        // #endregion
        return this.getDashboardStats(filters)
      }

      const backendData = await response.json();
      console.log('Frontend - Dados recebidos da API:', backendData);
      
      const projectsData = backendData?.projects || {}
      const expensesData = backendData?.expenses || {}
      const currentPeriod = backendData?.current_period || {}
      const previousPeriod = backendData?.previous_period || {}

      // Mapear dados do backend para estrutura esperada pelo frontend
      const mappedData: DashboardStats = {
        projects: {
          total_projects: Number(projectsData?.total_projects ?? backendData?.total_projects ?? 0),
          active_projects: Number(projectsData?.active_projects ?? backendData?.active_projects ?? 0),
          completed_projects: Number(projectsData?.completed_projects ?? backendData?.completed_projects ?? 0),
          paused_projects: Number(projectsData?.paused_projects ?? backendData?.paused_projects ?? 0),
          total_project_value: Number(
            projectsData?.total_project_value ?? (Number(backendData?.faturamento || 0) + Number(backendData?.aReceber || 0))
          ),
          total_paid_value: Number(projectsData?.total_paid_value ?? backendData?.faturamento ?? 0)
        },
        expenses: {
          total_expenses: Number(expensesData?.total_expenses ?? backendData?.total_expenses ?? 0),
          total_expenses_amount: Number(expensesData?.total_expenses_amount ?? backendData?.despesas ?? 0),
          expense_categories: Number(expensesData?.expense_categories ?? backendData?.expense_categories ?? 0)
        },
        previous_period: {
          revenue: Number(previousPeriod?.revenue ?? 0),
          expenses: Number(previousPeriod?.expenses ?? 0),
          receivable: Number(previousPeriod?.receivable ?? 0)
        },
        current_period: {
          revenue: Number(currentPeriod?.revenue ?? backendData?.faturamento ?? 0),
          expenses: Number(currentPeriod?.expenses ?? backendData?.despesas ?? 0),
          profit: Number(currentPeriod?.profit ?? backendData?.lucro ?? 0),
          receivable: Number(currentPeriod?.receivable ?? backendData?.aReceber ?? 0)
        },
        current_receivable: Number(backendData?.current_receivable ?? backendData?.aReceber ?? 0),
        revenue_by_month: Array.isArray(backendData?.revenue_by_month) ? backendData.revenue_by_month.map((item: any) => ({
          month: String(item.month),
          revenue: Number(item.revenue || 0),
          expenses: Number(item.expenses || 0)
        })) : [],
        expenses_by_category: Array.isArray(backendData?.expenses_by_category) ? backendData.expenses_by_category.map((item: any) => ({
          category: String(item.category || 'Sem categoria'),
          total_amount: Number((item.total_amount ?? item.total) || 0),
          count: Number(item.count || 0)
        })) : [],
        recent_projects: Array.isArray(backendData?.recent_projects) ? backendData.recent_projects.map((p: any) => ({
          id: String(p.id),
          name: String(p.name || 'Projeto sem nome'),
          status: String(p.status || 'indefinido'),
          project_value: Number(p.project_value || 0),
          created_at: String(p.created_at || '')
        })) : []
      };
      
      console.log('Frontend - Dados mapeados:', mappedData);
      return { data: mappedData };
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas do backend:', error);
      // #region debug-point E:dashboard-fallback-direct-supabase-catch
      fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"dashboard-stats-404",runId:"post-fix",hypothesisId:"E",location:"src/api/supabase-client.ts:getBackendDashboardStats:catch-fallback",msg:"[DEBUG] Erro no backend da dashboard; usando consulta direta no Supabase",data:{error:error?.message||String(error)},ts:Date.now()})}).catch(()=>{});
      // #endregion
      return this.getDashboardStats(filters)
    }
  },

  async getDashboardStats(filters?: {
    startDate?: string;
    endDate?: string;
    previousStartDate?: string;
    previousEndDate?: string;
  }): Promise<{ data: DashboardStats; error?: string }> {
    try {
      const now = new Date()
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
      if (projectsError) {
        return { data: buildEmptyDashboardStats(), error: projectsError.message }
      }

      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
      if (expensesError) {
        return { data: buildEmptyDashboardStats(), error: expensesError.message }
      }

      const allProjects = projects || []
      const allExpenses = expenses || []
      const currentProjects = allProjects.filter((project) =>
        isDateWithinRange(getProjectReferenceDate(project), filters?.startDate, filters?.endDate)
      )

      const totalProjects = currentProjects.length
      const activeProjects = currentProjects.filter((project) => project.status === 'active').length
      const completedProjects = currentProjects.filter((project) => project.status === 'completed').length
      const pausedProjects = currentProjects.filter((project) => project.status === 'paused').length
      const totalProjectValue = currentProjects.reduce((sum, project) => sum + (Number(project.project_value) || 0), 0)
      const totalPaidValue = currentProjects.reduce((sum, project) => sum + (Number(project.paid_value) || 0), 0)
      const totalReceivable = totalProjectValue - totalPaidValue

      const totalExpenses = allExpenses.length
      const totalExpensesAmount = allExpenses.reduce(
        (sum, expense) => sum + calculateExpenseTotalForRange(expense, filters?.startDate, filters?.endDate),
        0
      )
      const expenseCategories = new Set(
        allExpenses
          .filter((expense) => calculateExpenseTotalForRange(expense, filters?.startDate, filters?.endDate) > 0)
          .map((expense) => expense.category || 'Outros')
      ).size

      // Calcular receita por mês (últimos 12 meses)
      const revenueByMonth = []
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        const monthlyRevenue = allProjects
          .filter((project) => {
            const refDate = getProjectReferenceDate(project)
            if (!refDate) return false
            const projectDate = new Date(refDate)
            return projectDate.getFullYear() === date.getFullYear() &&
              projectDate.getMonth() === date.getMonth()
          })
          .reduce((sum, project) => sum + (Number(project.project_value) || 0), 0)

        const monthlyExpenses = allExpenses.reduce(
          (sum, expense) => sum + calculateMonthlyAmount(
            getExpenseAmountValue(expense),
            normalizeBillingType(expense.billing_type),
            expense.date || expense.expense_date || expense.created_at,
            date.getFullYear(),
            date.getMonth() + 1
          ),
          0
        )
        
        revenueByMonth.push({
          month: monthStr,
          revenue: monthlyRevenue,
          expenses: monthlyExpenses
        })
      }

      // Despesas por categoria
      const expensesByCategory = allExpenses.reduce((acc, expense) => {
        const category = expense.category || 'Outros'
        const totalForRange = calculateExpenseTotalForRange(expense, filters?.startDate, filters?.endDate)
        if (totalForRange <= 0) {
          return acc
        }
        if (!acc[category]) {
          acc[category] = { total_amount: 0, count: 0 }
        }
        acc[category].total_amount += totalForRange
        acc[category].count += 1
        return acc
      }, {} as Record<string, { total_amount: number; count: number }>)

      const expensesByCategoryArray = Object.entries(expensesByCategory).map(([category, data]) => ({
        category,
        total_amount: data.total_amount,
        count: data.count
      }))

      // Projetos recentes (últimos 5)
      const recentProjects = [...currentProjects].sort((a, b) => 
        new Date(getProjectReferenceDate(b)).getTime() - new Date(getProjectReferenceDate(a)).getTime()
      ).slice(0, 5).map(p => ({
        id: String(p.id),
        name: p.name,
        status: p.status,
        project_value: Number(p.project_value) || 0,
        created_at: getProjectReferenceDate(p)
      }))

      // Calcular período anterior se os filtros estiverem disponíveis
      let previousRevenue = 0
      let previousExpenses = 0
      let previousReceivable = 0
      
      if (filters?.previousStartDate && filters?.previousEndDate) {
        const previousProjects = allProjects.filter((project) =>
          isDateWithinRange(getProjectReferenceDate(project), filters.previousStartDate, filters.previousEndDate)
        )
        previousRevenue = previousProjects.reduce((sum, project) => sum + (Number(project.project_value) || 0), 0)
        const previousPaidValue = previousProjects.reduce((sum, project) => sum + (Number(project.paid_value) || 0), 0)
        previousReceivable = previousRevenue - previousPaidValue
        previousExpenses = allExpenses.reduce(
          (sum, expense) => sum + calculateExpenseTotalForRange(expense, filters.previousStartDate, filters.previousEndDate),
          0
        )
      }

      // Calcular período atual
      const currentRevenue = totalProjectValue
      const currentExpenses = totalExpensesAmount
      const currentProfit = currentRevenue - currentExpenses
      const currentReceivable = totalReceivable

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
          revenue: previousRevenue,
          expenses: previousExpenses,
          receivable: previousReceivable
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
      return { data: buildEmptyDashboardStats(), error: 'Erro ao buscar estatísticas do dashboard' }
    }
  },


}

// APIs já exportadas individualmente acima
