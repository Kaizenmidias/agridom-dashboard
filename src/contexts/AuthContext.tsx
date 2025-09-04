import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { loginUser, registerUser, verifyToken, updateUserProfile, uploadAvatar, changePassword } from '../api/auth'
import { AuthUser, LoginCredentials, RegisterCredentials, AuthResponse } from '../types/database'
import { getUsers } from '../api/crud'

interface AuthContextType {
  user: AuthUser | null
  usuarios: AuthUser[]
  loading: boolean
  error: string | null
  isAdmin: boolean
  login: (credentials: LoginCredentials) => Promise<AuthResponse | null>
  register: (credentials: RegisterCredentials) => Promise<AuthResponse | null>
  logout: () => void
  updateProfile: (data: Partial<AuthUser>) => Promise<AuthUser | null>
  uploadAvatar: (file: File) => Promise<AuthUser | null>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  refreshUserData: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [usuarios, setUsuarios] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Calcular se o usuário é admin baseado no campo is_admin ou cargo
  const isAdmin = user?.is_admin || 
    (user?.role && (
      user.role.toLowerCase() === 'administrador' ||
      user.role.toLowerCase() === 'admin' ||
      user.role.toLowerCase() === 'administrator'
    )) || false

  // Função para carregar lista de usuários
  const loadUsuarios = async () => {
    if (!user?.can_access_users) return
    
    try {
      const usuariosList = await getUsers()
      // Garantir que usuariosList seja sempre um array
      setUsuarios(Array.isArray(usuariosList) ? usuariosList : [])
      setError(null)
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
      // Em caso de erro, definir como array vazio
      setUsuarios([])
      setError('Erro ao carregar usuários')
    }
  }

  // Verificar se há dados de usuário salvos no localStorage e validar token
  useEffect(() => {
    const initAuth = async () => {
      try {
        const userData = localStorage.getItem('user_data')
        const token = localStorage.getItem('auth_token')
        
        if (userData && token) {
          try {
            // Primeiro, definir o usuário com os dados salvos
            const parsedUserData = JSON.parse(userData)
            setUser(parsedUserData)
            
            // Depois verificar se o token ainda é válido
            try {
              const validUser = await verifyToken(token)
              
              if (validUser) {
                // Token válido, atualizar com dados mais recentes se necessário
                localStorage.setItem('user_data', JSON.stringify(validUser))
                setUser(validUser)
              } else {
                // Token inválido, limpar dados
                console.warn('Token inválido, fazendo logout')
                localStorage.removeItem('user_data')
                localStorage.removeItem('auth_token')
                setUser(null)
              }
            } catch (tokenError) {
              // Se houver erro na verificação do token (ex: servidor offline),
              // manter o usuário logado temporariamente
              console.warn('Erro na verificação do token, mantendo usuário logado temporariamente:', tokenError)
              // Não fazer logout automático em caso de erro de rede
            }
          } catch (parseError) {
            // Erro ao fazer parse dos dados salvos
            console.error('Erro ao fazer parse dos dados do usuário:', parseError)
            localStorage.removeItem('user_data')
            localStorage.removeItem('auth_token')
            setUser(null)
          }
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error)
        // Só limpar dados se for um erro crítico
        if (error.message?.includes('JSON')) {
          localStorage.removeItem('user_data')
          localStorage.removeItem('auth_token')
        }
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  // Polling para verificar atualizações de permissões
  useEffect(() => {
    if (!user) return

    const checkForUpdates = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return

        const updatedUser = await verifyToken(token)
        if (updatedUser) {
          // Verificar se as permissões mudaram
          const permissionsChanged = [
            'can_access_dashboard',
            'can_access_projects', 
            'can_access_briefings',
            'can_access_codes',
            'can_access_expenses',
            'can_access_crm',
            'can_access_users'
          ].some(permission => user[permission as keyof AuthUser] !== updatedUser[permission as keyof AuthUser])

          if (permissionsChanged) {
            localStorage.setItem('user_data', JSON.stringify(updatedUser))
            setUser(updatedUser)
            console.log('Permissões do usuário atualizadas automaticamente')
          }
        }
      } catch (error) {
        // Silenciar erros de polling para não interferir na experiência do usuário
      }
    }

    // Verificar a cada 30 segundos
    const interval = setInterval(checkForUpdates, 30000)

    return () => clearInterval(interval)
  }, [user])

  // Carregar usuários quando o usuário logado mudar
  useEffect(() => {
    if (user?.can_access_users) {
      loadUsuarios()
    } else {
      setUsuarios([])
    }
  }, [user])

  // Função para fazer login
  const login = async (credentials: LoginCredentials): Promise<AuthResponse | null> => {
    try {
      setLoading(true)
      
      // Fazer login usando a API real
      const response = await loginUser(credentials)
      
      if (response.user) {
        // Salvar dados do usuário no localStorage
        localStorage.setItem('user_data', JSON.stringify(response.user))
        localStorage.setItem('auth_token', response.token)
        
        setUser(response.user)
      }
      
      return response
    } catch (error) {
      console.error('Erro no login:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Função para registrar novo usuário
  const register = async (credentials: RegisterCredentials): Promise<AuthResponse | null> => {
    try {
      setLoading(true)
      
      // Registrar usuário usando a API real
      const response = await registerUser(credentials)
      
      if (response.user) {
        // Salvar dados do usuário no localStorage
        localStorage.setItem('user_data', JSON.stringify(response.user))
        localStorage.setItem('auth_token', response.token)
        
        setUser(response.user)
      }
      
      return response
    } catch (error) {
      console.error('Erro no registro:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Função para fazer logout
  const logout = () => {
    localStorage.removeItem('user_data')
    localStorage.removeItem('auth_token')
    setUser(null)
  }

  // Função para atualizar perfil do usuário
  const updateProfile = async (data: Partial<AuthUser>): Promise<AuthUser | null> => {
    try {
      if (!user) {
        throw new Error('Usuário não autenticado')
      }
      
      setLoading(true)
      
      // Atualizar perfil usando a API real
      const updatedUser = await updateUserProfile(data)
      
      if (updatedUser) {
        // Salvar no localStorage
        localStorage.setItem('user_data', JSON.stringify(updatedUser))
        
        setUser(updatedUser)
      }
      
      return updatedUser
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Função para fazer upload de avatar
  const handleUploadAvatar = async (file: File): Promise<AuthUser | null> => {
    try {
      if (!user) {
        throw new Error('Usuário não autenticado')
      }
      
      setLoading(true)
      
      // Fazer upload do avatar
      const updatedUser = await uploadAvatar(file)
      
      if (updatedUser) {
        // Salvar no localStorage
        localStorage.setItem('user_data', JSON.stringify(updatedUser))
        
        setUser(updatedUser)
      }
      
      return updatedUser
    } catch (error) {
      console.error('Erro ao fazer upload do avatar:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Função para alterar senha
  const handleChangePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      if (!user) {
        throw new Error('Usuário não autenticado')
      }
      
      setLoading(true)
      
      // Alterar senha usando a API real
      await changePassword(currentPassword, newPassword)
    } catch (error) {
      console.error('Erro ao alterar senha:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Função para recarregar dados do usuário atual
  const refreshUserData = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token')
      
      if (!token || !user) {
        return
      }
      
      // Verificar token e obter dados atualizados do usuário
      const updatedUser = await verifyToken(token)
      
      if (updatedUser) {
        // Atualizar dados no localStorage e no estado
        localStorage.setItem('user_data', JSON.stringify(updatedUser))
        setUser(updatedUser)
      }
    } catch (error) {
      console.error('Erro ao recarregar dados do usuário:', error)
      // Se houver erro, manter o usuário atual
    }
  }

  const value: AuthContextType = {
    user,
    usuarios,
    loading,
    error,
    isAdmin,
    login,
    register,
    logout,
    updateProfile,
    uploadAvatar: handleUploadAvatar,
    changePassword: handleChangePassword,
    refreshUserData,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

// Hook para verificar se o usuário está autenticado
export function useRequireAuth() {
  const { user, loading } = useAuth()
  
  useEffect(() => {
    if (!loading && !user) {
      // Redirecionar para login se não estiver autenticado
      window.location.href = '/login'
    }
  }, [user, loading])
  
  return { user, loading }
}

// Função utilitária para obter o token atual
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

// Função utilitária para verificar se o token é válido
export async function isTokenValid(token: string): Promise<boolean> {
  try {
    const user = await verifyToken(token)
    return user !== null
  } catch {
    return false
  }
}