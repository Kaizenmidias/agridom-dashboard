import { createClient } from '@supabase/supabase-js'

// Debug completo das variáveis de ambiente
console.log('🔍 SUPABASE.TS - Iniciando configuração');
console.log('📊 Environment Mode:', import.meta.env.MODE);
console.log('🌍 Todas as variáveis import.meta.env:', import.meta.env);

// Configuração do Supabase usando variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug logs detalhados
console.log('🔍 DEBUG Supabase Config:');
console.log('VITE_SUPABASE_URL:', supabaseUrl);
console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'UNDEFINED');
console.log('URL válida?', !!supabaseUrl && supabaseUrl.includes('supabase.co'));
console.log('Key válida?', !!supabaseAnonKey && supabaseAnonKey.length > 50);

// Verificação mais robusta
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRO CRÍTICO: Variáveis de ambiente do Supabase não encontradas!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl || 'UNDEFINED');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Definida' : 'UNDEFINED');
  console.error('Verifique se as variáveis estão configuradas na Vercel!');
  
  // Em vez de throw, vamos criar um cliente mock para evitar crash
  console.warn('⚠️ Criando cliente Supabase com valores padrão para evitar crash...');
}

// Usar valores padrão se as variáveis não estiverem definidas
const finalUrl = supabaseUrl || 'https://qwbpruywwfjadkudegcj.supabase.co'
const finalKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YnBydXl3d2ZqYWRrdWRlZ2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NjMyNTAsImV4cCI6MjA3MjUzOTI1MH0.dyXrYaREdizc-UZM6NJP1Dp7RpDlzbU4pxHutJhGoy8'

console.log('🔧 Criando cliente Supabase com:');
console.log('URL final:', finalUrl);
console.log('Key final:', finalKey ? `${finalKey.substring(0, 20)}...` : 'UNDEFINED');

export const supabase = createClient(finalUrl, finalKey)

// Log de inicialização do cliente
console.log('✅ Cliente Supabase inicializado!');
console.log('🔗 Cliente URL:', supabase.supabaseUrl);
console.log('🔑 Cliente Key:', supabase.supabaseKey ? `${supabase.supabaseKey.substring(0, 20)}...` : 'UNDEFINED');

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