require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qwbpruywwfjadkudegcj.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YnBydXl3d2ZqYWRrdWRlZ2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NjMyNTAsImV4cCI6MjA3MjUzOTI1MH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseAccess() {
  console.log('🔍 Testando acesso ao Supabase...');
  console.log('URL:', supabaseUrl);
  console.log('Anon Key:', supabaseAnonKey.substring(0, 20) + '...');
  
  try {
    // Teste 1: Verificar conexão
    console.log('\n📡 Teste 1: Verificando conexão...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('projects')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.error('❌ Erro na conexão:', healthError.message);
      return;
    }
    
    console.log('✅ Conexão estabelecida com sucesso!');
    
    // Teste 2: Listar projetos
    console.log('\n📋 Teste 2: Listando projetos...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*');
    
    if (projectsError) {
      console.error('❌ Erro ao buscar projetos:', projectsError.message);
    } else {
      console.log('✅ Projetos encontrados:', projects?.length || 0);
      if (projects && projects.length > 0) {
        console.log('Primeiro projeto:', projects[0]);
      }
    }
    
    // Teste 3: Listar despesas
    console.log('\n💰 Teste 3: Listando despesas...');
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*');
    
    if (expensesError) {
      console.error('❌ Erro ao buscar despesas:', expensesError.message);
    } else {
      console.log('✅ Despesas encontradas:', expenses?.length || 0);
    }
    
    // Teste 4: Listar códigos
    console.log('\n🏷️ Teste 4: Listando códigos...');
    const { data: codes, error: codesError } = await supabase
      .from('codes')
      .select('*');
    
    if (codesError) {
      console.error('❌ Erro ao buscar códigos:', codesError.message);
    } else {
      console.log('✅ Códigos encontrados:', codes?.length || 0);
    }
    
    console.log('\n🎉 Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testSupabaseAccess();