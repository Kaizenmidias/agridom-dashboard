const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSupabaseInserts() {
  console.log('🔍 Iniciando debug dos erros 409 Conflict...');
  
  let validUserId = 1;
  
  try {
    // 1. Verificar se user_id = 1 existe
    console.log('\n1️⃣ Verificando se user_id = 1 existe...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', 1)
      .single();
    
    if (userError) {
      console.error('❌ Erro ao buscar user_id = 1:', userError);
      console.log('💡 Buscando qualquer usuário disponível...');
      
      const { data: anyUser, error: anyUserError } = await supabase
        .from('users')
        .select('id, email, name')
        .limit(1)
        .single();
      
      if (anyUserError) {
        console.error('❌ Nenhum usuário encontrado:', anyUserError);
        return;
      } else {
        console.log('✅ Usuário encontrado:', anyUser);
        console.log('💡 Use user_id =', anyUser.id, 'nas inserções');
        validUserId = anyUser.id;
      }
    } else {
      console.log('✅ User_id = 1 existe:', userData);
      validUserId = userData.id;
    }
    
    // 2. Testar inserção de projeto
    console.log('\n2️⃣ Testando inserção de projeto...');
    const projectData = {
      name: `Projeto Teste ${Date.now()}`, // Nome único
      client: 'Cliente Teste',
      project_type: 'website',
      status: 'active',
      description: 'Projeto de teste para debug',
      project_value: 1000.00,
      paid_value: 0,
      delivery_date: null,
      completion_date: null,
      user_id: validUserId
    };
    
    console.log('📤 Dados do projeto:', projectData);
    
    const { data: projectResult, error: projectError } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();
    
    if (projectError) {
      console.error('❌ Erro 409 no projeto:', projectError);
      console.error('📋 Detalhes:', JSON.stringify(projectError, null, 2));
    } else {
      console.log('✅ Projeto criado:', projectResult);
    }
    
    // 3. Testar inserção de código
    console.log('\n3️⃣ Testando inserção de código...');
    const codeData = {
      title: `Código Teste ${Date.now()}`, // Título único
      language: 'javascript',
      code_content: 'console.log("Hello World");',
      description: 'Código de teste para debug',
      user_id: userData?.id || anyUser?.id || 1
    };
    
    console.log('📤 Dados do código:', codeData);
    
    const { data: codeResult, error: codeError } = await supabase
      .from('codes')
      .insert([codeData])
      .select()
      .single();
    
    if (codeError) {
      console.error('❌ Erro 409 no código:', codeError);
      console.error('📋 Detalhes:', JSON.stringify(codeError, null, 2));
    } else {
      console.log('✅ Código criado:', codeResult);
    }
    
    // 4. Testar inserção de despesa
    console.log('\n4️⃣ Testando inserção de despesa...');
    const expenseData = {
      description: `Despesa Teste ${Date.now()}`,
      value: 100.50,
      category: 'Teste',
      date: new Date().toISOString().split('T')[0],
      billing_type: 'unica',
      project_id: projectResult?.id || null,
      user_id: userData?.id || anyUser?.id || 1,
      notes: 'Despesa de teste para debug'
    };
    
    console.log('📤 Dados da despesa:', expenseData);
    
    const { data: expenseResult, error: expenseError } = await supabase
      .from('expenses')
      .insert([expenseData])
      .select()
      .single();
    
    if (expenseError) {
      console.error('❌ Erro 409 na despesa:', expenseError);
      console.error('📋 Detalhes:', JSON.stringify(expenseError, null, 2));
    } else {
      console.log('✅ Despesa criada:', expenseResult);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar debug
debugSupabaseInserts();