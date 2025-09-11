import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase usando variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Debug logs para desenvolvimento
if (import.meta.env.DEV) {
  console.log('🔍 SUPABASE.TS - Configuração de desenvolvimento');
  console.log('URL:', supabaseUrl);
  console.log('Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'UNDEFINED');
}

// Verificação das variáveis de ambiente
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERRO: Variáveis de ambiente do Supabase não encontradas!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl || 'UNDEFINED');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'Definida' : 'UNDEFINED');
  throw new Error('Configuração do Supabase incompleta');
}

// Criar cliente Supabase com configurações de autenticação otimizadas
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
  })

// Verificar sessão inicial e configurar listeners
const initializeAuth = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Erro ao obter sessão:', error.message)
      return
    }
    
    if (!session) {
      console.warn('Nenhuma sessão ativa encontrada')
    } else {
      console.log('Sessão ativa encontrada para:', session.user.email)
    }
  } catch (error) {
    console.error('Erro na inicialização da autenticação:', error)
  }
}

// Listener para mudanças no estado de autenticação
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session?.user?.email || 'No user')
  
  if (event === 'SIGNED_OUT' || !session) {
    // Limpar dados locais quando usuário sair
    localStorage.removeItem('user_data')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('last_token_verification')
    
    // Redirecionar para login se não estiver na página de login
    if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
      window.location.href = '/login'
    }
  }
  
  if (event === 'SIGNED_IN' && session) {
    console.log('Usuário autenticado com sucesso:', session.user.email)
  }
  
  if (event === 'TOKEN_REFRESHED' && session) {
    console.log('Token renovado automaticamente')
  }
})

// Inicializar autenticação
initializeAuth()

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: any, ...args: any[]) => {
  console.error('Supabase error:', error, ...args)
  return {
    error: error?.message || 'An error occurred',
    details: error
  }
}

// Helper function for authenticated requests
export const getAuthenticatedSupabase = () => {
  return supabase
}