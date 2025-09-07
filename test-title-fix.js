// Script para testar se o título dos códigos está sendo salvo corretamente
// Após a correção do problema de concatenação com ID único

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  console.log('Verifique se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTitleFix() {
  console.log('🧪 Testando correção do título dos códigos...');
  console.log('📍 URL Supabase:', supabaseUrl.substring(0, 30) + '...');
  
  try {
    // 1. Verificar se existe usuário ativo
    console.log('\n1️⃣ Verificando usuários ativos...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name, is_active')
      .eq('is_active', true)
      .limit(1);
    
    if (userError) {
      console.error('❌ Erro ao buscar usuários:', userError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.error('❌ Nenhum usuário ativo encontrado');
      console.log('💡 Execute o script create-test-user.sql primeiro');
      return;
    }
    
    console.log('✅ Usuário ativo encontrado:', users[0].email);
    const userId = users[0].id;
    
    // 2. Testar criação de código com título específico
    console.log('\n2️⃣ Testando criação de código com título específico...');
    
    const testTitle = 'Meu Botão Personalizado';
    const timestamp = Date.now();
    
    const codeData = {
      title: testTitle,
      language: 'css',
      code_content: `.meu-botao {
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
}

.meu-botao:hover {
  transform: translateY(-2px);
}`,
      description: 'Botão com gradiente e animação hover',
      user_id: userId
    };

    console.log('📝 Dados do código a ser criado:');
    console.log('   - Título:', testTitle);
    console.log('   - Linguagem:', codeData.language);
    console.log('   - User ID:', userId);
    
    const { data: newCode, error: insertError } = await supabase
      .from('codes')
      .insert(codeData)
      .select('*')
      .single();
    
    if (insertError) {
      console.error('❌ Erro ao inserir código:', insertError);
      return;
    }
    
    console.log('\n✅ Código criado com sucesso!');
    console.log('📊 Resultado da inserção:');
    console.log('   - ID:', newCode.id);
    console.log('   - Título salvo:', newCode.title);
    console.log('   - Título esperado:', testTitle);
    
    // 3. Verificar se o título foi salvo corretamente
    if (newCode.title === testTitle) {
      console.log('\n🎉 SUCESSO! O título foi salvo exatamente como digitado pelo usuário.');
      console.log('✅ Problema resolvido: não há mais concatenação com ID único.');
    } else {
      console.log('\n❌ PROBLEMA AINDA EXISTE!');
      console.log('   - Título esperado:', testTitle);
      console.log('   - Título salvo:', newCode.title);
      console.log('   - Diferença detectada: ainda há modificação do título original.');
    }
    
    // 4. Limpar dados de teste
    console.log('\n4️⃣ Limpando dados de teste...');
    const { error: deleteError } = await supabase
      .from('codes')
      .delete()
      .eq('id', newCode.id);
    
    if (deleteError) {
      console.warn('⚠️ Aviso: não foi possível deletar o código de teste:', deleteError.message);
    } else {
      console.log('✅ Código de teste removido com sucesso.');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testTitleFix().then(() => {
  console.log('\n🏁 Teste concluído.');
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});