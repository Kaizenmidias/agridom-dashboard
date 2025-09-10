// Tipos para o banco de dados

// Tipos de autenticação
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  can_access_dashboard?: boolean;
  can_access_briefings?: boolean;
  can_access_codes?: boolean;
  can_access_projects?: boolean;
  can_access_expenses?: boolean;
  can_access_crm?: boolean;
  can_access_users?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'user';
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

// Tipos de usuários
export interface User {
  id: number;
  email: string;
  password?: string;
  name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  can_access_dashboard: boolean;
  can_access_briefings: boolean;
  can_access_codes: boolean;
  can_access_projects: boolean;
  can_access_expenses: boolean;
  can_access_crm: boolean;
  can_access_users: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsertUser {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
  can_access_dashboard?: boolean;
  can_access_briefings?: boolean;
  can_access_codes?: boolean;
  can_access_projects?: boolean;
  can_access_expenses?: boolean;
  can_access_crm?: boolean;
  can_access_users?: boolean;
}

// Tipos de projetos
export interface Project {
  id: number;
  name: string;
  description?: string;
  client_name?: string;
  project_value: number;
  paid_value: number;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  start_date: string;
  end_date?: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface InsertProject {
  name: string;
  description?: string;
  client_name?: string;
  project_value: number;
  paid_value?: number;
  status?: 'active' | 'completed' | 'paused' | 'cancelled';
  start_date: string;
  end_date?: string;
  user_id: number;
}

// Tipos de despesas
export type BillingType = 'unica' | 'semanal' | 'mensal' | 'anual';

export interface Expense {
  id: number;
  project_id?: number;
  description: string;
  amount: number;
  value?: number; // Alias para amount
  category?: string;
  date: string;
  expense_date?: string; // Alias para date
  billing_type: BillingType;
  is_recurring?: boolean;
  recurring_day_of_week?: number | null;
  recurring_end_date?: string | null;
  original_expense_id?: number | null;
  notes?: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface InsertExpense {
  project_id?: number;
  description: string;
  amount: number;
  category?: string;
  date?: string;
  expense_date?: string;
  billing_type?: BillingType;
  is_recurring?: boolean;
  recurring_day_of_week?: number | null;
  recurring_end_date?: string | null;
  original_expense_id?: number | null;
  notes?: string;
  user_id: number;
}

// Tipos de códigos
export interface Code {
  id: number;
  name: string;
  language: string;
  code_content: string;
  description?: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface InsertCode {
  name: string;
  language: string;
  code_content: string;
  description?: string;
  user_id: number;
}

// Tipos de briefings
export interface Briefing {
  id: number;
  title: string;
  content: string;
  client_name?: string;
  project_type?: string;
  budget?: number;
  deadline?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface InsertBriefing {
  title: string;
  content: string;
  client_name?: string;
  project_type?: string;
  budget?: number;
  deadline?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  user_id: number;
}

// Tipos para estatísticas do dashboard
export interface DashboardStats {
  total_projects: number;
  total_value: number;
  total_paid: number;
  total_receivable: number;
  active_projects?: number;
  completed_projects?: number;
  total_expenses?: number;
  monthly_expenses?: number;
}

// Tipos para respostas da API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Tipos para paginação
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Tipos para filtros
export interface ProjectFilters {
  status?: string;
  user_id?: number;
  start_date?: string;
  end_date?: string;
  client_name?: string;
}

export interface ExpenseFilters {
  project_id?: number;
  category?: string;
  billing_type?: BillingType;
  start_date?: string;
  end_date?: string;
  user_id?: number;
}

export interface CodeFilters {
  language?: string;
  user_id?: number;
  search?: string;
}

// Tipos para operações CRUD
export type CreateInput<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;

// Exportar todos os tipos como um namespace
export namespace Database {
  export type User = User;
  export type Project = Project;
  export type Expense = Expense;
  export type Code = Code;
  export type Briefing = Briefing;
  export type AuthUser = AuthUser;
  export type DashboardStats = DashboardStats;
}

// Tipos para o Supabase (se necessário)
export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    role?: string;
  };
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  user: SupabaseUser;
}