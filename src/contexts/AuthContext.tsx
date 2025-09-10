import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { loginUser, registerUser, verifyToken, updateUserProfile, uploadAvatar, changePassword } from '../api/auth'
import { AuthUser, LoginCredentials, RegisterCredentials, AuthResponse } from '../types/database'
import { getUsers } from '../api/crud'
import { supabase } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AuthContextType {
  user: AuthUser | null
  usuarios: AuthUser[]
  loading: boolean
  error: string | null
  isAdmin: boolean
  session: Session | null
  supabaseUser: User | null
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
  const [session, setSession] = useState<Session | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null)
  
  // Calcular se o usuário é admin baseado no campo is_admin ou cargo
  const isAdmin = user?.is_admin === true || 
    (user?.role && (
      user.role.toLowerCase() === 'administrador' ||
      user.role.toLowerCase() === 'admin' ||
      user.role.toLowerCase() === 'administrator'
    )) || false

  // Calcular se está autenticado baseado na sessão do Supabase
  const isAuthenticated = !!session && !!supabaseUser

  // Função para carregar lista de usuários
  const loadUsuarios = async () => {
    try {
      // Verificar se há sessão ativa do Supabase
      if (!session || !supabaseUser) {
        console.warn('Tentativa de carregar usuários sem sessão ativa')
        setUsuarios([])
        setError(null) // Não é um erro se não há sessão
        return
      }
      
      const usuariosList = await getUsers()
      // Garantir que usuariosList seja sempre um array
      setUsuarios(Array.isArray(usuariosList) ? usuariosList : [])
      setError(null)
      console.log('Usuários carregados com sucesso:', usuariosList?.length || 0)
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err)
      // Em caso de erro, definir como array vazio
      setUsuarios([])
      
      // Se for erro de token, não mostrar erro para o usuário (será tratado pela autenticação)
      if (err?.message?.includes('Token') || err?.message?.includes('token')) {
        console.warn('Erro de token ao carregar usuários, será tratado pela autenticação')
        setError(null)
      } else {
        setError('Erro ao carregar usuários')
      }
    }
  }

  // Inicializar autenticação com Supabase
  useEffect(() => {
    let isMounted = true;
    
    const initAuth = async () => {
      try {
        // Obter sessão atual do Supabase
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Erro ao obter sessão:', error.message)
          if (isMounted) {
            setSession(null)
            setSupabaseUser(null)
            setUser(null)
            setLoading(false)
          }
          return
        }
        
        if (isMounted) {
          setSession(session)
          setSupabaseUser(session?.user || null)
          
          // Se há sessão, tentar carregar dados do usuário do localStorage
          if (session?.user) {
            const userData = localStorage.getItem('user_data')
            if (userData) {
              try {
                const parsedUser = JSON.parse(userData)
                setUser(parsedUser)
                console.log('Usuário carregado do cache:', parsedUser.email)
              } catch (parseError) {
                console.error('Dados de usuário corrompidos:', parseError)
                localStorage.removeItem('user_data')
              }
            }
          } else {
            // Sem sessão, limpar dados
            setUser(null)
            localStorage.removeItem('user_data')
            localStorage.removeItem('token')
          }
          
          setLoading(false)
        }
      } catch (error) {
        console.error('Erro ao inicializar autenticação:', error)
        if (isMounted) {
          setSession(null)
          setSupabaseUser(null)
          setUser(null)
          setLoading(false)
        }
      }
    }

    // Configurar listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email || 'No user')
        
        if (isMounted) {
          setSession(session)
          setSupabaseUser(session?.user || null)
          
          if (event === 'SIGNED_OUT' || !session) {
            setUser(null)
            localStorage.removeItem('user_data')
            localStorage.removeItem('token')
          }
          
          if (event === 'SIGNED_IN' && session) {
            // Tentar carregar dados do usuário do localStorage
            const userData = localStorage.getItem('user_data')
            if (userData) {
              try {
                const parsedUser = JSON.parse(userData)
                setUser(parsedUser)
              } catch (error) {
                console.error('Erro ao parsear dados do usuário:', error)
                localStorage.removeItem('user_data')
              }
            }
          }
        }
      }
    )

    // Inicializar
    initAuth()
    
    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Polling para verificar atualizações de permissões (desabilitado para evitar throttling)
  useEffect(() => {
    if (!user) return

    // Polling desabilitado temporariamente para resolver problema de throttling
    // As permissões serão atualizadas apenas no próximo login
    console.log('Polling de permissões desabilitado para evitar throttling do navegador')

    // Se necessário reativar no futuro, usar intervalo muito maior (30+ minutos)
    // const interval = setInterval(checkForUpdates, 1800000) // 30 minutos
    // return () => clearInterval(interval)
  }, [user])

  // Carregamento automático de usuários quando há sessão ativa
  useEffect(() => {
    if (session && supabaseUser) {
      loadUsuarios();
    } else {
      setUsuarios([]);
    }
  }, [session, supabaseUser])

  // Função para fazer login
  const login = async (credentials: LoginCredentials): Promise<AuthResponse | null> => {
    try {
      setLoading(true)
      setError(null)
      
      // Fazer login usando o Supabase diretamente
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      if (data.session && data.user) {
        // Atualizar estados
        setSession(data.session)
        setSupabaseUser(data.user)
        
        // Criar objeto de usuário compatível com o sistema
        const authUser: AuthUser = {
          id: data.user.id,
          email: data.user.email!,
          full_name: data.user.user_metadata?.full_name || data.user.email!,
          role: data.user.user_metadata?.role || 'user',
          is_admin: data.user.user_metadata?.is_admin || false,
          avatar_url: data.user.user_metadata?.avatar_url,
          bio: data.user.user_metadata?.bio,
          created_at: data.user.created_at,
          updated_at: data.user.updated_at || data.user.created_at
        }
        
        setUser(authUser)
        
        // Salvar dados no localStorage
        localStorage.setItem('user_data', JSON.stringify(authUser))
        if (data.session.access_token) {
          localStorage.setItem('token', data.session.access_token)
        }
        
        console.log('Login realizado com sucesso:', authUser.email)
        
        return {
          user: authUser,
          token: data.session.access_token,
          success: true
        }
      }
      
      throw new Error('Falha na autenticação')
    } catch (error: any) {
      console.error('Erro no login:', error)
      setError(error.message || 'Erro no login')
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
        localStorage.setItem('token', response.token)
        
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
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Erro ao fazer logout:', error.message)
      }
      
      // Limpar estados locais
      setUser(null)
      setUsuarios([])
      setSession(null)
      setSupabaseUser(null)
      setError(null)
      
      // Limpar localStorage
      localStorage.removeItem('user_data')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      
      // Limpar sessionStorage também
      sessionStorage.clear()
      
      console.log('Logout realizado com sucesso')
    } catch (error) {
      console.error('Erro no logout:', error)
    }
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
      const token = localStorage.getItem('token')
      
      if (!token || !user) {
        return
      }
      
      // Verificar token e obter dados atualizados do usuário
      const result = await verifyToken(token)
      
      if (result && result.user && result.valid) {
        // Atualizar dados no localStorage e no estado
        localStorage.setItem('user_data', JSON.stringify(result.user))
        setUser(result.user)
      } else {
        // Token inválido - apenas logar o erro, não fazer logout automático
        // O logout deve ser feito apenas quando o usuário explicitamente sair
        console.warn('Token inválido detectado em refreshUserData, mas mantendo sessão ativa')
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
    session,
    supabaseUser,
    login,
    register,
    logout,
    updateProfile,
    uploadAvatar: handleUploadAvatar,
    changePassword: handleChangePassword,
    refreshUserData,
    isAuthenticated
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

// Hook removido para evitar loops de redirecionamento
// Use ProtectedRoute ou verificações condicionais no componente

// Função utilitária para obter o token atual
export function getAuthToken(): string | null {
  return localStorage.getItem('token')
}

// Função utilitária para verificar se o token é válido
export async function isTokenValid(token: string): Promise<boolean> {
  try {
    const result = await verifyToken(token)
    return result && result.valid === true
  } catch {
    return false
  }
}