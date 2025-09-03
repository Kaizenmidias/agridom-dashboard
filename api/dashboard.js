const jwt = require('jsonwebtoken');
const { query } = require('./db');

// Middleware de autenticação
function authenticateToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Token não fornecido');
  }

  try {
    const decoded = jwt.verify(token, process.env.dashboard_SUPABASE_JWT_SECRET);
    return decoded.userId;
  } catch (error) {
    throw new Error('Token inválido');
  }
}

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const userId = authenticateToken(req);

    // Estatísticas do dashboard
    const stats = {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      totalExpenses: 0,
      monthlyExpenses: 0,
      totalParcels: 0,
      activeCrops: 0,
      totalCodes: 0,
      recentProjects: [],
      expensesByMonth: [],
      projectsByStatus: [],
      recentExpenses: []
    };

    // Buscar dados do MySQL
    const projectsResult = await query('SELECT * FROM projects');
    const expensesResult = await query('SELECT * FROM expenses');
    const parcelsResult = await query('SELECT * FROM parcels');
    const cropsResult = await query('SELECT * FROM crops');
    const codesResult = await query('SELECT * FROM codes');

    const projects = projectsResult.rows;
    const expenses = expensesResult.rows;
    const parcels = parcelsResult.rows;
    const crops = cropsResult.rows;
    const codes = codesResult.rows;

    // Total de projetos
    stats.totalProjects = projects.length;

    // Projetos ativos
    stats.activeProjects = projects.filter(p => ['em_andamento', 'planejamento'].includes(p.status)).length;

    // Projetos concluídos
    stats.completedProjects = projects.filter(p => p.status === 'concluido').length;

    // Total de despesas
    stats.totalExpenses = expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

    // Despesas do mês atual
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    stats.monthlyExpenses = expenses
      .filter(expense => {
        const expenseDate = new Date(expense.expense_date);
        return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
      })
      .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

    // Total de parcelas
    stats.totalParcels = parcels.length;

    // Cultivos ativos
    stats.activeCrops = crops.filter(crop => crop.status === 'ativo').length;

    // Total de códigos
    stats.totalCodes = codes.length;

    // Projetos recentes
    stats.recentProjects = projects
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(project => ({
        id: project.id,
        name: project.name,
        client_name: project.client_name,
        status: project.status,
        created_at: project.created_at
      }));

    // Despesas por mês (últimos 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const expensesByMonth = {};
    expenses
      .filter(expense => {
        const expenseDate = new Date(expense.expense_date);
        return expenseDate >= sixMonthsAgo;
      })
      .forEach(expense => {
        const expenseDate = new Date(expense.expense_date);
        const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
        expensesByMonth[monthKey] = (expensesByMonth[monthKey] || 0) + (parseFloat(expense.amount) || 0);
      });
    
    stats.expensesByMonth = Object.entries(expensesByMonth)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Projetos por status
    const projectsByStatus = {};
    projects.forEach(project => {
      projectsByStatus[project.status] = (projectsByStatus[project.status] || 0) + 1;
    });
    
    stats.projectsByStatus = Object.entries(projectsByStatus)
      .map(([status, count]) => ({ status, count }));

    // Despesas recentes
    stats.recentExpenses = expenses
      .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date))
      .slice(0, 5)
      .map(expense => ({
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        expense_date: expense.expense_date,
        category: expense.category
      }));

    res.json(stats);

  } catch (error) {
    console.error('Erro na API do dashboard:', error);
    
    if (error.message === 'Token não fornecido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}