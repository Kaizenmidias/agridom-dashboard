const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente Supabase com service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qwbpruywwfjadkudegcj.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YnBydXl3d2ZqYWRrdWRlZ2NqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk2MzI1MCwiZXhwIjoyMDcyNTM5MjUwfQ.5q5dHv8Xn5QMtiTPJEpEIg8gcCM_tKstzCsEuBV2dwM';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyRLSPolicies() {
  console.log('🔧 Aplicando políticas RLS...');
  
  try {
    // Habilitar RLS nas tabelas
    console.log('📋 Habilitando RLS nas tabelas...');
    
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE projects ENABLE ROW LEVEL SECURITY;'
    });
    
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;'
    });
    
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE codes ENABLE ROW LEVEL SECURITY;'
    });
    
    console.log('✅ RLS habilitado em todas as tabelas');
    
    // Aplicar policies para PROJECTS
    console.log('📋 Aplicando policies para tabela PROJECTS...');
    
    const projectPolicies = [
      'CREATE POLICY "Allow public read access on projects" ON projects FOR SELECT USING (true);',
      'CREATE POLICY "Allow public insert access on projects" ON projects FOR INSERT WITH CHECK (true);',
      'CREATE POLICY "Allow public update access on projects" ON projects FOR UPDATE USING (true) WITH CHECK (true);',
      'CREATE POLICY "Allow public delete access on projects" ON projects FOR DELETE USING (true);'
    ];
    
    for (const policy of projectPolicies) {
      try {
        await supabase.rpc('exec_sql', { sql: policy });
        console.log('✅ Policy aplicada:', policy.substring(0, 50) + '...');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠️ Policy já existe:', policy.substring(0, 50) + '...');
        } else {
          console.error('❌ Erro ao aplicar policy:', error.message);
        }
      }
    }
    
    // Aplicar policies para EXPENSES
    console.log('📋 Aplicando policies para tabela EXPENSES...');
    
    const expensePolicies = [
      'CREATE POLICY "Allow public read access on expenses" ON expenses FOR SELECT USING (true);',
      'CREATE POLICY "Allow public insert access on expenses" ON expenses FOR INSERT WITH CHECK (true);',
      'CREATE POLICY "Allow public update access on expenses" ON expenses FOR UPDATE USING (true) WITH CHECK (true);',
      'CREATE POLICY "Allow public delete access on expenses" ON expenses FOR DELETE USING (true);'
    ];
    
    for (const policy of expensePolicies) {
      try {
        await supabase.rpc('exec_sql', { sql: policy });
        console.log('✅ Policy aplicada:', policy.substring(0, 50) + '...');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠️ Policy já existe:', policy.substring(0, 50) + '...');
        } else {
          console.error('❌ Erro ao aplicar policy:', error.message);
        }
      }
    }
    
    // Aplicar policies para CODES
    console.log('📋 Aplicando policies para tabela CODES...');
    
    const codePolicies = [
      'CREATE POLICY "Allow public read access on codes" ON codes FOR SELECT USING (true);',
      'CREATE POLICY "Allow public insert access on codes" ON codes FOR INSERT WITH CHECK (true);',
      'CREATE POLICY "Allow public update access on codes" ON codes FOR UPDATE USING (true) WITH CHECK (true);',
      'CREATE POLICY "Allow public delete access on codes" ON codes FOR DELETE USING (true);'
    ];
    
    for (const policy of codePolicies) {
      try {
        await supabase.rpc('exec_sql', { sql: policy });
        console.log('✅ Policy aplicada:', policy.substring(0, 50) + '...');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠️ Policy já existe:', policy.substring(0, 50) + '...');
        } else {
          console.error('❌ Erro ao aplicar policy:', error.message);
        }
      }
    }
    
    console.log('\n🎉 Todas as políticas RLS foram aplicadas com sucesso!');
    console.log('\n📊 Verificando configuração...');
    
    // Verificar se as policies foram criadas
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql: `SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('projects', 'expenses', 'codes') ORDER BY tablename, policyname;`
      });
    
    if (policiesError) {
      console.error('❌ Erro ao verificar policies:', policiesError.message);
    } else {
      console.log('\n📋 Policies ativas:');
      console.table(policies);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Executar
applyRLSPolicies().then(() => {
  console.log('\n✅ Script finalizado!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});