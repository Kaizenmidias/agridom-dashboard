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
  const isAdmin = user?.is_admin === true || 
    (user?.role && (
      user.role.toLowerCase() === 'administrador' ||
      user.role.toLowerCase() === 'admin' ||
      user.role.toLowerCase() === 'administrator'
    )) || false

  // Função para carregar lista de usuários
  const loadUsuarios = async () => {
    try {
      // Verificar se há token antes de tentar carregar usuários
      const token = localStorage.getItem('token')
      if (!token) {
        console.warn('Tentativa de carregar usuários sem token de autenticação')
        setUsuarios([])
        setError(null) // Não é um erro se não há token
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

  // Verificar se há dados de usuário salvos no localStorage e validar token
  useEffect(() => {
    let isMounted = true;
    
    const initAuth = async () => {
      try {
        const userData = localStorage.getItem('user_data')
        const token = localStorage.getItem('token')
        const lastVerification = localStorage.getItem('last_token_verification')
        const now = Date.now()
        
        // Verificar token apenas se passou mais de 30 minutos desde a última verificação
        const shouldVerifyToken = !lastVerification || (now - parseInt(lastVerification)) > 1800000; // 30 minutos
        
        if (userData && token) {
          try {
            const parsedUser = JSON.parse(userData)
            
            if (shouldVerifyToken) {
              // Verificar se o token é válido apenas se necessário
              const result = await verifyToken(token)
              
              if (result && result.user && result.valid && isMounted) {
                // Token válido, usar dados mais recentes do servidor
                localStorage.setItem('user_data', JSON.stringify(result.user))
                localStorage.setItem('last_token_verification', now.toString())
                setUser(result.user)
                console.log('Token verificado - usuário autenticado:', result.user.email)
              } else if (isMounted) {
                // Token inválido, limpar dados
                console.warn('Token inválido detectado, limpando dados de autenticação')
                localStorage.removeItem('user_data')
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                localStorage.removeItem('last_token_verification')
                setUser(null)
              }
            } else {
              // Usar dados do localStorage sem verificar token (cache válido)
              if (isMounted) {
                setUser(parsedUser)
                console.log('Usando dados de autenticação em cache:', parsedUser.email)
              }
            }
          } catch (tokenError) {
            // Erro na verificação do token - limpar dados
            console.error('Erro na verificação do token:', tokenError)
            if (isMounted) {
              localStorage.removeItem('user_data')
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              localStorage.removeItem('last_token_verification')
              setUser(null)
            }
          }
        } else {
          // Não há dados salvos
          if (isMounted) {
            setUser(null)
          }
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error)
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // Executar inicialização
    initAuth();
    
    return () => {
      isMounted = false;
    };
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

  // Carregar usuários quando o usuário logado mudar
  useEffect(() => {
    if (user) {
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
        localStorage.setItem('token', response.token)
        
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
  const logout = () => {
    // Limpar todos os dados de autenticação possíveis
    localStorage.removeItem('user_data')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    
    // Limpar sessionStorage também
    sessionStorage.clear()
    
    setUser(null)
    setUsuarios([])
    setError(null)
    
    console.log('Logout realizado - todos os dados de autenticação foram limpos')
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
        // Token inválido, fazer logout
        logout()
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