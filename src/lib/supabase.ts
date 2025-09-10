import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase usando variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

// Debug logs para produção
console.log('🔍 DEBUG Supabase Config:');
console.log('VITE_SUPABASE_URL:', supabaseUrl);
console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'Não definida');
console.log('Environment:', import.meta.env.MODE);
console.log('All env vars:', Object.keys(import.meta.env));

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas:');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Definida' : 'Não definida');
  throw new Error('Missing Supabase environment variables. Verifique se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas na Vercel.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Log de inicialização do cliente
console.log('✅ Cliente Supabase inicializado com sucesso');

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