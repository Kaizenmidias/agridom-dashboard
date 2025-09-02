// Tipos para as tabelas do banco de dados MariaDB

export interface Database {
  tables: {
    // Tabela de usuários
    users: {
      Row: {
        id: string
        email: string
        password_hash: string
        full_name: string | null
        position: string | null
        bio: string | null
        avatar_url: string | null
        is_active: boolean
        created_at: string
        updated_at: string
        can_access_dashboard: boolean
        can_access_briefings: boolean
        can_access_codes: boolean
        can_access_projects: boolean
        can_access_expenses: boolean
        can_access_crm: boolean
        can_access_users: boolean
      }
      Insert: {
        id?: string
        email: string
        password_hash: string
        full_name?: string | null
        position?: string | null
        bio?: string | null
        avatar_url?: string | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
        can_access_dashboard?: boolean
        can_access_briefings?: boolean
        can_access_codes?: boolean
        can_access_projects?: boolean
        can_access_expenses?: boolean
        can_access_crm?: boolean
        can_access_users?: boolean
      }
      Update: {
        id?: string
        email?: string
        password_hash?: string
        full_name?: string | null
        position?: string | null
        bio?: string | null
        avatar_url?: string | null
        is_active?: boolean
        updated_at?: string
        can_access_dashboard?: boolean
        can_access_briefings?: boolean
        can_access_codes?: boolean
        can_access_projects?: boolean
        can_access_expenses?: boolean
        can_access_crm?: boolean
        can_access_users?: boolean
      }
    }
    // Tabela de projetos
    projects: {
      Row: {
        id: string
        name: string
        client: string | null
        project_type: string | null
        status: 'active' | 'completed' | 'paused' | 'cancelled'
        description: string | null
        project_value: number | null
        paid_value: number | null
        delivery_date: string | null
        completion_date: string | null
        user_id: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        name: string
        client?: string | null
        project_type?: string | null
        status?: 'active' | 'completed' | 'paused' | 'cancelled'
        description?: string | null
        project_value?: number | null
        paid_value?: number | null
        delivery_date?: string | null
        user_id: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        name?: string
        client?: string | null
        project_type?: string | null
        status?: 'active' | 'completed' | 'paused' | 'cancelled'
        description?: string | null
        project_value?: number | null
        paid_value?: number | null
        delivery_date?: string | null
        updated_at?: string
      }
    }
    // Tabela de despesas
    expenses: {
      Row: {
        id: string
        project_id: string
        description: string
        amount: number
        category: string
        date: string
        user_id: string
        billing_type: 'unica' | 'semanal' | 'mensal' | 'anual'
        is_recurring: boolean
        recurring_day_of_week: number | null
        recurring_end_date: string | null
        original_expense_id: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        project_id: string
        description: string
        amount: number
        category: string
        date: string
        user_id: string
        billing_type?: 'unica' | 'semanal' | 'mensal' | 'anual'
        is_recurring?: boolean
        recurring_day_of_week?: number | null
        recurring_end_date?: string | null
        original_expense_id?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        project_id?: string
        description?: string
        amount?: number
        category?: string
        date?: string
        billing_type?: 'unica' | 'semanal' | 'mensal' | 'anual'
        is_recurring?: boolean
        recurring_day_of_week?: number | null
        recurring_end_date?: string | null
        original_expense_id?: string | null
        notes?: string | null
        updated_at?: string
      }
    }
    // Tabela de parcelas
    parcels: {
      Row: {
        id: string
        name: string
        area: number
        location: string | null
        soil_type: string | null
        user_id: string
        project_id: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        name: string
        area: number
        location?: string | null
        soil_type?: string | null
        user_id: string
        project_id?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        name?: string
        area?: number
        location?: string | null
        soil_type?: string | null
        project_id?: string | null
        updated_at?: string
      }
    }
    // Tabela de culturas
    crops: {
      Row: {
        id: string
        name: string
        variety: string | null
        parcel_id: string
        planting_date: string | null
        harvest_date: string | null
        status: 'planted' | 'growing' | 'harvested'
        yield_expected: number | null
        yield_actual: number | null
        user_id: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        name: string
        variety?: string | null
        parcel_id: string
        planting_date?: string | null
        harvest_date?: string | null
        status?: 'planted' | 'growing' | 'harvested'
        yield_expected?: number | null
        yield_actual?: number | null
        user_id: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        name?: string
        variety?: string | null
        planting_date?: string | null
        harvest_date?: string | null
        status?: 'planted' | 'growing' | 'harvested'
        yield_expected?: number | null
        yield_actual?: number | null
        updated_at?: string
      }
    }
    // Tabela de códigos
    codes: {
      Row: {
        id: string
        name: string
        code_type: 'css' | 'html' | 'javascript'
        code_content: string
        description: string | null
        user_id: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        name: string
        code_type: 'css' | 'html' | 'javascript'
        code_content: string
        description?: string | null
        user_id?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        name?: string
        code_type?: 'css' | 'html' | 'javascript'
        code_content?: string
        description?: string | null
        user_id?: string | null
        updated_at?: string
      }
    }
  }
}

// Tipos auxiliares para facilitar o uso
export type User = Database['tables']['users']['Row']
export type Project = Database['tables']['projects']['Row']
export type Expense = Database['tables']['expenses']['Row']
export type Parcel = Database['tables']['parcels']['Row']
export type Crop = Database['tables']['crops']['Row']

export type InsertUser = Database['tables']['users']['Insert']
export type InsertProject = Database['tables']['projects']['Insert']
export type InsertExpense = Database['tables']['expenses']['Insert']
export type InsertParcel = Database['tables']['parcels']['Insert']
export type InsertCrop = Database['tables']['crops']['Insert']

export type UpdateUser = Database['tables']['users']['Update']
export type UpdateProject = Database['tables']['projects']['Update']
export type UpdateExpense = Database['tables']['expenses']['Update']
export type UpdateParcel = Database['tables']['parcels']['Update']
export type UpdateCrop = Database['tables']['crops']['Update']

// Tipos específicos para códigos
export type Code = Database['tables']['codes']['Row']
export type InsertCode = Database['tables']['codes']['Insert']
export type UpdateCode = Database['tables']['codes']['Update']

// Tipos para autenticação
export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  position: string | null
  bio: string | null
  avatar_url: string | null
  is_active: boolean
  can_access_dashboard: boolean
  can_access_briefings: boolean
  can_access_codes: boolean
  can_access_projects: boolean
  can_access_expenses: boolean
  can_access_crm: boolean
  can_access_users: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  full_name?: string
}

export interface AuthResponse {
  user: AuthUser
  token: string
}