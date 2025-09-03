import { User, Project, Expense, Parcel, Crop, Code, InsertCode, UpdateCode } from '../types/database'
import { API_BASE_URL } from '../config/api'

// Função auxiliar para fazer requisições autenticadas
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  console.log('Frontend - Token de autenticação:', token ? 'Presente' : 'Ausente');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    console.error('Frontend - Erro na requisição:', response.status, response.statusText);
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    console.error('Frontend - Detalhes do erro:', error);
    throw new Error(error.error || 'Erro na requisição');
  }

  const data = await response.json();
  console.log('Frontend - Resposta da API recebida:', data);
  return data;
};

// ============= USERS API =============
export async function getUsers(): Promise<User[]> {
  return await fetchWithAuth(`${API_BASE_URL}/users`);
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    return await fetchWithAuth(`${API_BASE_URL}/users/${id}`);
  } catch (error) {
    return null;
  }
}

export async function createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
  return await fetchWithAuth(`${API_BASE_URL}/users`, {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function updateUser(id: string, userData: Partial<User>): Promise<User | null> {
  try {
    return await fetchWithAuth(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  } catch (error) {
    return null;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await fetchWithAuth(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    return false;
  }
}

// ============= DASHBOARD STATS API =============

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

export async function getDashboardStats(filters?: {
  startDate?: string;
  endDate?: string;
  previousStartDate?: string;
  previousEndDate?: string;
}): Promise<DashboardStats> {
  console.log('Frontend - getDashboardStats chamada com filtros:', filters);
  
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.previousStartDate) params.append('previousStartDate', filters.previousStartDate);
  if (filters?.previousEndDate) params.append('previousEndDate', filters.previousEndDate);
  
  const url = `${API_BASE_URL}/dashboard/stats${params.toString() ? '?' + params.toString() : ''}`;
  console.log('Frontend - URL da requisição:', url);
  
  return await fetchWithAuth(url);
}

// ============= PROJECTS API =============
export async function getProjects(filters?: { user_id?: string; status?: string }): Promise<Project[]> {
  const params = new URLSearchParams();
  if (filters?.user_id) params.append('user_id', filters.user_id);
  if (filters?.status) params.append('status', filters.status);
  
  const url = `${API_BASE_URL}/projects${params.toString() ? `?${params.toString()}` : ''}`;
  return await fetchWithAuth(url);
}

export async function getProjectById(id: string): Promise<Project | null> {
  try {
    return await fetchWithAuth(`${API_BASE_URL}/projects/${id}`);
  } catch (error) {
    return null;
  }
}

export async function createProject(projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
  return await fetchWithAuth(`${API_BASE_URL}/projects`, {
    method: 'POST',
    body: JSON.stringify(projectData),
  });
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<Project | null> {
  try {
    return await fetchWithAuth(`${API_BASE_URL}/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
  } catch (error) {
    return null;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    await fetchWithAuth(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    return false;
  }
}

// ============= EXPENSES API =============

export async function getExpenses(filters?: { project_id?: string; category?: string }): Promise<Expense[]> {
  const params = new URLSearchParams();
  if (filters?.project_id) params.append('project_id', filters.project_id);
  if (filters?.category) params.append('category', filters.category);
  
  const url = `${API_BASE_URL}/expenses${params.toString() ? `?${params.toString()}` : ''}`;
  return await fetchWithAuth(url);
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  try {
    return await fetchWithAuth(`${API_BASE_URL}/expenses/${id}`);
  } catch (error) {
    return null;
  }
}

export async function createExpense(expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'>): Promise<Expense> {
  // Garantir que a data esteja no formato correto
  const processedData = {
    ...expenseData,
    expense_date: expenseData.expense_date || expenseData.date,
    date: expenseData.date || expenseData.expense_date
  };
  
  return await fetchWithAuth(`${API_BASE_URL}/expenses`, {
    method: 'POST',
    body: JSON.stringify(processedData),
  });
}

export async function updateExpense(id: string, expenseData: Partial<Expense>): Promise<Expense | null> {
  try {
    // Garantir que a data esteja no formato correto
    const processedData = {
      ...expenseData,
      expense_date: expenseData.expense_date || expenseData.date,
      date: expenseData.date || expenseData.expense_date
    };
    
    return await fetchWithAuth(`${API_BASE_URL}/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(processedData),
    });
  } catch (error) {
    return null;
  }
}

export async function deleteExpense(id: string): Promise<boolean> {
  try {
    await fetchWithAuth(`${API_BASE_URL}/expenses/${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    return false;
  }
}

// ============= PARCELS API =============

export async function getParcels(filters?: { project_id?: string }): Promise<Parcel[]> {
  const params = new URLSearchParams();
  if (filters?.project_id) params.append('project_id', filters.project_id);
  
  const url = `${API_BASE_URL}/parcels${params.toString() ? `?${params.toString()}` : ''}`;
  return await fetchWithAuth(url);
}

export async function getParcelById(id: string): Promise<Parcel | null> {
  try {
    return await fetchWithAuth(`${API_BASE_URL}/parcels/${id}`);
  } catch (error) {
    return null;
  }
}

export async function createParcel(parcelData: Omit<Parcel, 'id' | 'created_at' | 'updated_at'>): Promise<Parcel> {
  return await fetchWithAuth(`${API_BASE_URL}/parcels`, {
    method: 'POST',
    body: JSON.stringify(parcelData),
  });
}

export async function updateParcel(id: string, parcelData: Partial<Parcel>): Promise<Parcel | null> {
  try {
    return await fetchWithAuth(`${API_BASE_URL}/parcels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(parcelData),
    });
  } catch (error) {
    return null;
  }
}

export async function deleteParcel(id: string): Promise<boolean> {
  try {
    await fetchWithAuth(`${API_BASE_URL}/parcels/${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    return false;
  }
}

// ============= CROPS API =============
export async function getCrops(filters?: { parcel_id?: string; season?: string }): Promise<Crop[]> {
  const params = new URLSearchParams();
  if (filters?.parcel_id) params.append('parcel_id', filters.parcel_id);
  if (filters?.season) params.append('season', filters.season);
  
  const url = `${API_BASE_URL}/crops${params.toString() ? `?${params.toString()}` : ''}`;
  return await fetchWithAuth(url);
}

export async function getCropById(id: string): Promise<Crop | null> {
  try {
    return await fetchWithAuth(`${API_BASE_URL}/crops/${id}`);
  } catch (error) {
    return null;
  }
}

export async function createCrop(cropData: Omit<Crop, 'id' | 'created_at' | 'updated_at'>): Promise<Crop> {
  return await fetchWithAuth(`${API_BASE_URL}/crops`, {
    method: 'POST',
    body: JSON.stringify(cropData),
  });
}

export async function updateCrop(id: string, cropData: Partial<Crop>): Promise<Crop | null> {
  try {
    return await fetchWithAuth(`${API_BASE_URL}/crops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cropData),
    });
  } catch (error) {
    return null;
  }
}

export async function deleteCrop(id: string): Promise<boolean> {
  try {
    await fetchWithAuth(`${API_BASE_URL}/crops/${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    return false;
  }
}

// ============= CODES API =============

export async function getCodes(filters?: { search?: string; code_type?: string }): Promise<Code[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.code_type) params.append('code_type', filters.code_type);
  
  const url = `${API_BASE_URL}/codes${params.toString() ? `?${params.toString()}` : ''}`;
  return await fetchWithAuth(url);
}

export async function getCode(id: string): Promise<Code> {
  return await fetchWithAuth(`${API_BASE_URL}/codes/${id}`);
}

export async function createCode(data: InsertCode): Promise<Code> {
  return await fetchWithAuth(`${API_BASE_URL}/codes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCode(id: string, data: UpdateCode): Promise<Code> {
  return await fetchWithAuth(`${API_BASE_URL}/codes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCode(id: string): Promise<boolean> {
  try {
    await fetchWithAuth(`${API_BASE_URL}/codes/${id}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    return false;
  }
}