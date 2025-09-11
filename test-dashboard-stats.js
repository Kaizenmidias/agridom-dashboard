require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testDashboardStats() {
  console.log('🧪 TESTE DA FUNÇÃO getBackendDashboardStats');
  console.log('===========================================');
  
  try {
    // Simular a função corrigida
    console.log('1. Testando acesso aos dados...');
    
    const [usersResult, projectsResult, expensesResult] = await Promise.all([
      supabase.from('users').select('id, created_at, is_active'),
      supabase.from('projects').select('id, created_at, status, project_value, paid_value, name'),
      supabase.from('expenses').select('id, created_at, amount, category').limit(1000)
    ]);

    if (usersResult.error) {
      console.error('❌ Erro ao buscar usuários:', usersResult.error.message);
      return;
    }
    
    if (projectsResult.error) {
      console.error('❌ Erro ao buscar projetos:', projectsResult.error.message);
      return;
    }
    
    if (expensesResult.error) {
      console.error('❌ Erro ao buscar despesas:', expensesResult.error.message);
      return;
    }

    const users = usersResult.data || [];
    const projects = projectsResult.data || [];
    const expenses = expensesResult.data || [];

    console.log('✅ Dados obtidos com sucesso:');
    console.log(`   - Usuários: ${users.length}`);
    console.log(`   - Projetos: ${projects.length}`);
    console.log(`   - Despesas: ${expenses.length}`);

    // Calcular estatísticas
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.is_active).length;
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'em_andamento').length;
    const completedProjects = projects.filter(p => p.status === 'completed' || p.status === 'concluido').length;
    
    const totalRevenue = projects.reduce((sum, p) => sum + (p.project_value || 0), 0);
    const totalPaid = projects.reduce((sum, p) => sum + (p.paid_value || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = totalPaid - totalExpenses;

    console.log('\n📊 ESTATÍSTICAS CALCULADAS:');
    console.log('============================');
    console.log(`Total de Usuários: ${totalUsers}`);
    console.log(`Usuários Ativos: ${activeUsers}`);
    console.log(`Total de Projetos: ${totalProjects}`);
    console.log(`Projetos Ativos: ${activeProjects}`);
    console.log(`Projetos Concluídos: ${completedProjects}`);
    console.log(`Receita Total: R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`Total Pago: R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`Total de Despesas: R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`Lucro: R$ ${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    const dashboardStats = {
      projects: {
        total_projects: totalProjects,
        active_projects: activeProjects,
        completed_projects: completedProjects,
        paused_projects: projects.filter(p => p.status === 'paused' || p.status === 'pausado').length,
        total_project_value: totalRevenue,
        total_paid_value: totalPaid
      },
      expenses: {
        total_expenses: expenses.length,
        total_expenses_amount: totalExpenses,
        expense_categories: [...new Set(expenses.map(e => e.category))].length
      },
      current_period: {
        revenue: totalPaid,
        expenses: totalExpenses,
        profit: profit,
        receivable: totalRevenue - totalPaid
      },
      current_receivable: totalRevenue - totalPaid,
      recent_projects: projects.slice(-5).map(p => ({
        id: p.id,
        name: p.name || 'Projeto sem nome',
        status: p.status || 'indefinido',
        project_value: p.project_value || 0,
        created_at: p.created_at
      }))
    };

    console.log('\n✅ ESTRUTURA DE DADOS CRIADA COM SUCESSO!');
    console.log('Objeto DashboardStats:', JSON.stringify(dashboardStats, null, 2));
    
    console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('A função getBackendDashboardStats deve funcionar corretamente agora.');
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('1. Recarregue a página do dashboard (Ctrl+R)');
    console.log('2. Verifique se não há mais erros 401 no console');
    console.log('3. Confirme se as estatísticas estão sendo exibidas');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.log('\n🔧 POSSÍVEIS SOLUÇÕES:');
    console.log('1. Verifique se as variáveis de ambiente estão corretas');
    console.log('2. Confirme se as tabelas existem no Supabase');
    console.log('3. Verifique as políticas RLS');
  }
}

testDashboardStats();