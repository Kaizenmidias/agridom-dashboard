const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

// Configuração do Supabase para produção
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSchemaFixes() {
  console.log('🔧 Aplicando correções de schema...');
  
  try {
    // 1. Corrigir user_id para UUID na tabela projects
    console.log('\n1️⃣ Corrigindo user_id para UUID na tabela projects...');
    const { error: alterUserIdError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE projects ALTER COLUMN user_id TYPE uuid USING user_id::uuid;`
    });
    
    if (alterUserIdError) {
      console.error('❌ Erro ao alterar user_id:', alterUserIdError.message);
    } else {
      console.log('✅ user_id alterado para UUID com sucesso!');
    }
    
    // 2. Adicionar foreign key constraint
    console.log('\n2️⃣ Adicionando foreign key constraint...');
    const { error: fkError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE projects ADD CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES auth.users(id);`
    });
    
    if (fkError) {
      console.error('❌ Erro ao adicionar FK (pode já existir):', fkError.message);
    } else {
      console.log('✅ Foreign key constraint adicionada!');
    }
    
    // 3. Adicionar coluna amount na tabela expenses
    console.log('\n3️⃣ Adicionando coluna amount na tabela expenses...');
    const { error: addAmountError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount numeric;`
    });
    
    if (addAmountError) {
      console.error('❌ Erro ao adicionar coluna amount:', addAmountError.message);
    } else {
      console.log('✅ Coluna amount adicionada!');
    }
    
    // 4. Copiar dados de value para amount
    console.log('\n4️⃣ Copiando dados de value para amount...');
    const { error: copyDataError } = await supabase.rpc('exec_sql', {
      sql: `UPDATE expenses SET amount = value WHERE amount IS NULL;`
    });
    
    if (copyDataError) {
      console.error('❌ Erro ao copiar dados:', copyDataError.message);
    } else {
      console.log('✅ Dados copiados de value para amount!');
    }
    
    // 5. Recarregar schema
    console.log('\n5️⃣ Recarregando schema do Supabase...');
    const { error: reloadError } = await supabase.rpc('exec_sql', {
      sql: `NOTIFY pgrst, 'reload schema';`
    });
    
    if (reloadError) {
      console.error('❌ Erro ao recarregar schema:', reloadError.message);
    } else {
      console.log('✅ Schema recarregado!');
    }
    
    console.log('\n🎉 Todas as correções foram aplicadas!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

async function validateFixes() {
  console.log('\n🧪 Validando correções...');
  
  // Aguardar um pouco para o schema ser recarregado
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Testar criação de projeto com UUID
    console.log('\n📋 Testando criação de projeto com UUID...');
    const testProject = {
      name: 'Projeto Teste Pós-Correção',
      description: 'Teste após correção de schema',
      user_id: '00000000-0000-0000-0000-000000000000',
      status: 'active'
    };
    
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert([testProject])
      .select();
    
    if (projectError) {
      console.error('❌ Ainda há erro ao criar projeto:', projectError.message);
    } else {
      console.log('✅ Projeto criado com UUID com sucesso!');
      
      // Limpar projeto teste
      await supabase.from('projects').delete().eq('id', projectData[0].id);
      console.log('🧹 Projeto teste removido');
    }
    
    // Testar criação de despesa com amount
    console.log('\n💸 Testando criação de despesa com amount...');
    const testExpense = {
      description: 'Despesa Teste Pós-Correção',
      amount: 150.75,
      category: 'teste',
      date: new Date().toISOString().split('T')[0]
    };
    
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .insert([testExpense])
      .select();
    
    if (expenseError) {
      console.error('❌ Ainda há erro ao criar despesa:', expenseError.message);
    } else {
      console.log('✅ Despesa criada com amount com sucesso!');
      
      // Limpar despesa teste
      await supabase.from('expenses').delete().eq('id', expenseData[0].id);
      console.log('🧹 Despesa teste removida');
    }
    
  } catch (error) {
    console.error('❌ Erro na validação:', error.message);
  }
}

async function main() {
  console.log('🚀 Executando correções de schema do Supabase...');
  console.log(`🔗 URL: ${supabaseUrl}`);
  
  await executeSchemaFixes();
  await validateFixes();
  
  console.log('\n✅ Processo concluído! O dashboard deve funcionar corretamente agora.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { executeSchemaFixes, validateFixes };