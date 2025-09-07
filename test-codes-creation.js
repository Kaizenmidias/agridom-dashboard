// Script para testar criação de códigos e validar correção do erro 409
// Execute com: node test-codes-creation.js

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

async function testCodeCreation() {
  console.log('🧪 Testando criação de códigos após correções...');
  console.log('📍 URL Supabase:', supabaseUrl.substring(0, 30) + '...');
  
  try {
    // 1. Verificar se existe usuário ativo
    console.log('\n1️⃣ Verificando usuários ativos...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name, is_active')
      .eq('is_active', true)
      .limit(5);
    
    if (userError) {
      console.error('❌ Erro ao buscar usuários:', userError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.error('❌ Nenhum usuário ativo encontrado');
      console.log('💡 Execute o script create-test-user.sql primeiro');
      return;
    }
    
    console.log('✅ Usuários ativos encontrados:', users.length);
    users.forEach(user => {
      console.log(`   - ID: ${user.id}, Email: ${user.email}, Nome: ${user.name}`);
    });
    
    const userId = users[0].id;
    
    // 2. Testar inserção de código usando SDK (método correto)
    console.log('\n2️⃣ Testando inserção de código usando SDK do Supabase...');
    
    const timestamp = Date.now();
    const codeData = {
      title: `Teste SDK ${timestamp}`,
      language: 'javascript',
      code_content: `// Código de teste criado em ${new Date().toISOString()}\nconsole.log('Hello World from SDK!');`,
      description: 'Código de teste criado via SDK do Supabase',
      user_id: userId
    };
    
    console.log('📤 Dados do código:', codeData);
    
    // Método correto: usar SDK sem querystring
    const { data: codeResult, error: codeError } = await supabase
      .from('codes')
      .insert(codeData)
      .select('*')
      .single();
    
    if (codeError) {
      console.error('❌ Erro 409 ou outro erro:', codeError);
      console.error('📋 Detalhes completos:', JSON.stringify(codeError, null, 2));
      
      // Analisar tipo de erro
      if (codeError.code === '23503') {
        console.log('💡 Erro de foreign key - user_id não existe');
      } else if (codeError.code === '23505') {
        console.log('💡 Erro de duplicação - registro já existe');
      } else if (codeError.code === '23514') {
        console.log('💡 Erro de constraint - verifique language (css, html, javascript)');
      } else if (codeError.message.includes('409')) {
        console.log('💡 Erro 409 Conflict - problema com a requisição');
      }
    } else {
      console.log('✅ Código criado com sucesso via SDK!');
      console.log('📋 Resultado:', {
        id: codeResult.id,
        title: codeResult.title,
        language: codeResult.language,
        user_id: codeResult.user_id,
        created_at: codeResult.created_at
      });
    }
    
    // 3. Verificar se o código foi realmente inserido
    console.log('\n3️⃣ Verificando se o código foi inserido na tabela...');
    
    const { data: allCodes, error: selectError } = await supabase
      .from('codes')
      .select('id, title, language, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (selectError) {
      console.error('❌ Erro ao buscar códigos:', selectError);
    } else {
      console.log('✅ Últimos códigos na tabela:');
      allCodes.forEach(code => {
        console.log(`   - ID: ${code.id}, Título: ${code.title}, Language: ${code.language}`);
      });
    }
    
    // 4. Demonstrar o método INCORRETO que causa erro 409
    console.log('\n4️⃣ Demonstrando método INCORRETO (REST API com querystring)...');
    console.log('❌ NUNCA faça assim:');
    console.log(`   POST ${supabaseUrl}/rest/v1/codes?columns="title","language","code_content","description","user_id"&select=*`);
    console.log('   ☝️ Isso causa erro 409 porque querystring não deve ser usada em POST');
    
    console.log('\n✅ Método CORRETO (SDK do Supabase):');
    console.log('   supabase.from(\'codes\').insert(data).select(\'*\').single()');
    console.log('   ☝️ SDK envia dados no body JSON automaticamente');
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar teste
testCodeCreation();