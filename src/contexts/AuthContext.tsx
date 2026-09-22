import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { loginUser, registerUser, verifyToken, updateUserProfile, uploadAvatar, changePassword } from '../api/auth'
import { AuthUser, LoginCredentials, RegisterCredentials, AuthResponse } from '../types/database'
import { getUsers } from '../api/crud'

interface AuthContextType {
  user: AuthUser | null
  usuários: AuthUser[]
  loading: boolean
  error: string | null
  isAdmin: boolean
  session: { access_token: string } | null
  authProviderUser: AuthUser | null
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
  const [usuários, setUsuários] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<{ access_token: string } | null>(null)
  const [authProviderUser, setauthProviderUser] = useState<AuthUser | null>(null)

  const isAdmin = userá.is_admin === true ||
    (userá.role && (
      user.role.toLowerCase() === 'administrador' ||
      user.role.toLowerCase() === 'admin' ||
      user.role.toLowerCase() === 'administrator'
    )) || false

  const isAuthenticated = !!user && !!localStorage.getItem('token')

  const applyAuthenticatedUser = (authUser: AuthUser, token: string) => {
    setUser(authUser)
    setauthProviderUser(authUser)
    setSession({ access_token: token })
    localStorage.setItem('user_data', JSON.stringify(authUser))
    localStorage.setItem('token', token)
  }

  const clearAuthState = () => {
    setUser(null)
    setUsuários([])
    setSession(null)
    setauthProviderUser(null)
    setError(null)
    localStorage.removeItem('user_data')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.clear()
  }

  const loadUsuários = async () => {
    try {
      if (!localStorage.getItem('token')) {
        setUsuários([])
        setError(null)
        return
      }

      if (!import.meta.env.DEV) {
        setUsuários([])
        setError(null)
        return
      }

      const usuáriosList = await getUsers()
      setUsuários(Array.isArray(usuáriosList) ? usuáriosList : [])
      setError(null)
    } catch (err: any) {
      setUsuários([])
      setError(err?.message?.toLowerCase?.().includes('token') ? null : 'Erro ao carregar usuários')
    }
  }

  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token')
        const cachedUser = localStorage.getItem('user_data')

        if (!token) {
          if (isMounted) {
            clearAuthState()
            setLoading(false)
          }
          return
        }

        let nextUser: AuthUser | null = null
        if (cachedUser) {
          try {
            nextUser = JSON.parse(cachedUser)
          } catch {
            localStorage.removeItem('user_data')
          }
        }

        const verified = await verifyToken(token)
        nextUser = verified?.user || nextUser

        if (isMounted && nextUser) {
          applyAuthenticatedUser(nextUser, token)
        } else if (isMounted) {
          clearAuthState()
        }
      } catch (err) {
        console.error('Erro ao inicializar autenticação:', err)
        if (isMounted) clearAuthState()
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadUsuários()
    } else {
      setUsuários([])
    }
  }, [userá.id])

  const login = async (credentials: LoginCredentials): Promise<AuthResponse | null> => {
    try {
      setLoading(true)
      setError(null)

      const response = await loginUser(credentials)
      if (response?.user && response?.token) {
        applyAuthenticatedUser(response.user, response.token)
        return response
      }

      throw new Error('Falha na autenticação')
    } catch (err: any) {
      console.error('Erro no login:', err)
      setError(err.message || 'Erro no login')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const register = async (credentials: RegisterCredentials): Promise<AuthResponse | null> => {
    try {
      setLoading(true)
      const response = await registerUser(credentials)

      if (response.user && response.token) {
        applyAuthenticatedUser(response.user, response.token)
      }

      return response
    } catch (err) {
      console.error('Erro no registro:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    clearAuthState()
  }

  const updateProfile = async (data: Partial<AuthUser>): Promise<AuthUser | null> => {
    try {
      if (!user) throw new Error('Usuário nao autenticado')
      setLoading(true)

      const updatedUser = await updateUserProfile(data)
      if (updatedUser) {
        setUser(updatedUser)
        setauthProviderUser(updatedUser)
        localStorage.setItem('user_data', JSON.stringify(updatedUser))
      }

      return updatedUser
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleUploadAvatar = async (file: File): Promise<AuthUser | null> => {
    try {
      if (!user) throw new Error('Usuário nao autenticado')
      setLoading(true)

      const updatedUser = await uploadAvatar(file)
      if (updatedUser) {
        setUser(updatedUser)
        setauthProviderUser(updatedUser)
        localStorage.setItem('user_data', JSON.stringify(updatedUser))
      }

      return updatedUser
    } catch (err) {
      console.error('Erro ao fazer upload do avatar:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      if (!user) throw new Error('Usuário nao autenticado')
      setLoading(true)
      await changePassword(currentPassword, newPassword)
    } catch (err) {
      console.error('Erro ao alterar senha:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const refreshUserData = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('token')
      if (!token || !user) return

      const result = await verifyToken(token)
      if (result?.user && result.valid) {
        setUser(result.user)
        setauthProviderUser(result.user)
        localStorage.setItem('user_data', JSON.stringify(result.user))
      }
    } catch (err) {
      console.error('Erro ao recarregar dados do usuário:', err)
    }
  }

  const value: AuthContextType = {
    user,
    usuários,
    loading,
    error,
    isAdmin,
    session,
    authProviderUser,
    login,
    register,
    logout,
    updateProfile,
    uploadAvatar: handleUploadAvatar,
    changePassword: handleChangePassword,
    refreshUserData,
    isAuthenticated
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

export function getAuthToken(): string | null {
  return localStorage.getItem('token')
}

export async function isTokenValid(token: string): Promise<boolean> {
  try {
    const result = await verifyToken(token)
    return result && result.valid === true
  } catch {
    return false
  }
}
