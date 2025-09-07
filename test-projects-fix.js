// Script para testar correção do erro 409 na criação de projetos
// Execute com: node test-projects-fix.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  console.log('Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProjectCreation() {
  console.log('🧪 Testando criação de projetos após correção do erro 409...');
  
  const testProjectName = `Projeto Teste ${Date.now()}`;
  
  try {
    // Dados do projeto de teste
    const projectData = {
      name: testProjectName,
      client: 'Cliente Teste',
      project_type: 'website',
      status: 'active',
      description: 'Projeto criado para testar correção do erro 409',
      project_value: 5000.00,
      paid_value: 1000.00,
      delivery_date: '2024-12-31',
      completion_date: null,
      user_id: 1
    };

    console.log('📝 Dados do projeto:', projectData);
    
    // Tentar criar o projeto
    console.log('🔄 Criando projeto...');
    const { data, error } = await supabase
      .from('projects')
      .insert([projectData]);
    
    if (error) {
      console.error('❌ Erro ao criar projeto:', error);
      console.error('Código do erro:', error.code);
      console.error('Mensagem:', error.message);
      return false;
    }
    
    console.log('✅ Projeto criado com sucesso!');
    console.log('📊 Resultado:', data);
    
    // Verificar se o projeto foi realmente criado
    console.log('🔍 Verificando se o projeto foi salvo...');
    const { data: savedProject, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('name', testProjectName)
      .single();
    
    if (fetchError) {
      console.error('❌ Erro ao buscar projeto criado:', fetchError);
      return false;
    }
    
    if (savedProject) {
      console.log('✅ Projeto encontrado no banco de dados!');
      console.log('📋 Nome salvo:', savedProject.name);
      console.log('👤 Cliente:', savedProject.client);
      console.log('💰 Valor:', savedProject.project_value);
      
      // Verificar se o nome foi salvo exatamente como digitado
      if (savedProject.name === testProjectName) {
        console.log('✅ Nome do projeto salvo corretamente!');
      } else {
        console.log('⚠️ Nome do projeto foi modificado:');
        console.log('  Esperado:', testProjectName);
        console.log('  Salvo:', savedProject.name);
      }
      
      // Limpar dados de teste
      console.log('🧹 Removendo projeto de teste...');
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', savedProject.id);
      
      if (deleteError) {
        console.error('⚠️ Erro ao remover projeto de teste:', deleteError);
      } else {
        console.log('✅ Projeto de teste removido com sucesso!');
      }
      
      return true;
    } else {
      console.error('❌ Projeto não foi encontrado no banco de dados');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando teste de correção do erro 409 em projetos...');
  console.log('=' .repeat(60));
  
  const success = await testProjectCreation();
  
  console.log('=' .repeat(60));
  if (success) {
    console.log('🎉 Teste concluído com sucesso! O erro 409 foi corrigido.');
    console.log('✅ Projetos agora podem ser criados normalmente.');
  } else {
    console.log('❌ Teste falhou. O erro 409 ainda persiste.');
    console.log('🔧 Verifique as configurações do Supabase e RLS.');
  }
}

// Executar o teste
main().catch(console.error);