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
    let initializationComplete = false;
    
    const initAuth = async () => {
      // Evitar múltiplas execuções e throttling
      if (initializationComplete) return;
      initializationComplete = true;
      
      // Verificar se já foi inicializado recentemente para evitar loops
      const lastInit = sessionStorage.getItem('auth_last_init');
      const now = Date.now();
      if (lastInit && (now - parseInt(lastInit)) < 1000) {
        console.log('Inicialização de auth muito recente, pulando para evitar throttling');
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      sessionStorage.setItem('auth_last_init', now.toString());
      
      try {
        const userData = localStorage.getItem('user_data')
        const token = localStorage.getItem('token')
        
        console.log('Inicializando autenticação...', { hasUserData: !!userData, hasToken: !!token });
        
        if (userData && token) {
          try {
            const parsedUser = JSON.parse(userData)
            
            // Usar dados em cache sem verificação automática para evitar loops
            if (isMounted) {
              setUser(parsedUser)
              console.log('Usuário autenticado carregado do cache:', parsedUser.email)
            }
          } catch (parseError) {
            // Erro ao parsear dados - limpar dados corrompidos
            console.error('Dados de usuário corrompidos, limpando cache:', parseError)
            if (isMounted) {
              localStorage.removeItem('user_data')
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              localStorage.removeItem('last_token_verification')
              setUser(null)
            }
          }
        } else {
          // Não há dados salvos - usuário não autenticado
          if (isMounted) {
            setUser(null)
            console.log('Nenhum usuário autenticado encontrado')
          }
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error)
        if (isMounted) {
          setUser(null)
        }
      } finally {
        // Sempre definir loading como false após inicialização
        if (isMounted) {
          setLoading(false)
          console.log('Inicialização de autenticação concluída')
        }
      }
    }

    // Executar inicialização com pequeno delay para evitar problemas de timing
    const timeoutId = setTimeout(initAuth, 50);
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
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

  // Carregamento automático de usuários desabilitado para resolver throttling
  // Os usuários serão carregados apenas quando necessário nas páginas específicas
  useEffect(() => {
    // Desabilitado temporariamente para resolver problema de throttling
    // if (user) {
    //   loadUsuarios();
    // } else {
    //   setUsuarios([]);
    // }
    console.log('Carregamento automático de usuários desabilitado para evitar throttling');
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