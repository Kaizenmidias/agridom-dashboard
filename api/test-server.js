const http = require('http');
const url = require('url');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase conectado');
} else {
  console.log('❌ Configuração do Supabase não encontrada');
}

// Função para autenticar token do Supabase
const authenticateToken = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token de autorização não fornecido');
  }
  
  const token = authHeader.substring(7);
  try {
    // Verificar o token com o Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      throw new Error('Token inválido ou usuário não encontrado');
    }
    return { userId: user.id, email: user.email };
  } catch (error) {
    throw new Error('Token inválido: ' + error.message);
  }
};

const server = http.createServer(async (req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  if (req.url === '/api/test') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    const response = {
      success: true,
      message: 'API funcionando!',
      timestamp: new Date().toISOString()
    };
    res.end(JSON.stringify(response));
    return;
  }
  
  if (req.url === '/api/users' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    const users = [
      { id: 1, name: 'João Silva', email: 'joao@example.com', role: 'admin', is_active: true },
      { id: 2, name: 'Maria Santos', email: 'maria@example.com', role: 'user', is_active: true },
      { id: 3, name: 'Pedro Costa', email: 'pedro@example.com', role: 'user', is_active: false }
    ];
    res.end(JSON.stringify({ success: true, data: users }));
    return;
  }
  
  if (req.url.startsWith('/api/dashboard/stats') && req.method === 'GET') {
    try {
      // Autenticar usuário
      const decoded = await authenticateToken(req);
      
      if (!supabase) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Supabase não configurado' }));
        return;
      }
      
      console.log('📊 Buscando dados reais do dashboard para user_id:', decoded.user?.id || decoded.id);
      console.log('🔍 Estrutura do token decodificado:', JSON.stringify(decoded, null, 2));
      
      // Buscar projetos do usuário
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', decoded.userId);
        
      if (projectsError) {
        console.error('Erro ao buscar projetos:', projectsError);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Erro ao buscar projetos' }));
        return;
      }
      
      // Buscar despesas do usuário (temporariamente desabilitado devido a problema de schema)
      const userId = decoded.userId || decoded.user?.id || decoded.id;
      let expenses = [];
      
      try {
        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', userId);
          
        if (expensesError) {
          console.warn('⚠️ Não foi possível buscar despesas (schema incompatível):', expensesError.message);
          expenses = []; // Usar array vazio por enquanto
        } else {
          expenses = expensesData || [];
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar despesas, continuando sem elas:', error.message);
        expenses = [];
      }
      
      console.log('📊 Projetos encontrados:', projects?.length || 0);
      console.log('📊 Despesas encontradas:', expenses?.length || 0);
      
      // Calcular estatísticas reais
      const totalProjects = projects?.length || 0;
      const totalValue = projects?.reduce((sum, p) => sum + (parseFloat(p.project_value) || 0), 0) || 0;
      const totalPaid = projects?.reduce((sum, p) => sum + (parseFloat(p.paid_value) || 0), 0) || 0;
      const totalReceivable = totalValue - totalPaid;
      
      const activeProjects = projects?.filter(p => p.status === 'active')?.length || 0;
      const completedProjects = projects?.filter(p => p.status === 'completed')?.length || 0;
      
      const totalExpenses = expenses?.reduce((sum, e) => sum + (parseFloat(e.amount) || parseFloat(e.value) || 0), 0) || 0;
      
      // Calcular despesas do mês atual
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyExpenses = expenses?.filter(e => {
        const expenseDate = new Date(e.date || e.expense_date);
        return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
      })?.reduce((sum, e) => sum + (parseFloat(e.amount) || parseFloat(e.value) || 0), 0) || 0;
      
      const stats = {
        projects: {
          total_paid_value: totalPaid,
          total_project_value: totalValue,
          total_receivable: totalReceivable,
          active_projects: activeProjects,
          completed_projects: completedProjects,
          total_projects: totalProjects
        },
        current_period: {
          expenses: totalExpenses,
          monthly_expenses: monthlyExpenses,
          revenue: totalPaid,
          receivable: totalReceivable,
          profit: totalPaid - totalExpenses
        },
        previous_period: {
          expenses: 0,
          revenue: 0,
          profit: 0
        },
        growth: {
          revenue_growth: 0,
          expense_growth: 0,
          profit_growth: 0
        },
        financial_summary: {
          total_value: totalValue,
          total_paid: totalPaid,
          total_receivable: totalReceivable,
          total_expenses: totalExpenses,
          net_profit: totalPaid - totalExpenses
        },
        alerts: []
      };
      
      console.log('📊 Estatísticas reais calculadas:', {
        totalProjects,
        totalPaid,
        activeProjects,
        completedProjects,
        monthlyExpenses
      });
      
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(stats));
      return;
      
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
  }
  
  // 404 para outras rotas
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Rota não encontrada' }));
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor de teste rodando na porta ${PORT}`);
});