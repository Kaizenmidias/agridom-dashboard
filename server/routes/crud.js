const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { calculateTotalMonthlyExpenses, calculateMonthlyAmount } = require('../utils/billing-calculations');
const { createClient } = require('@supabase/supabase-js');

// Inicializar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware para acessar a função query
const getQuery = (req) => req.app.locals.query;

// Cache temporário para tipos de cobrança originais
const billingTypeCache = new Map();

// Função para mapear tipos de cobrança para o banco de dados
const mapBillingTypeForDatabase = (billingType) => {
  // Mapeamento temporário para compatibilidade com constraint atual
  const typeMapping = {
    'mensal': 'mensal',
    'semanal': 'mensal', // Temporariamente mapear para mensal
    'anual': 'mensal'    // Temporariamente mapear para mensal
  };
  
  return typeMapping[billingType] || 'mensal';
};

// Função para armazenar tipo original no cache
const storeOriginalType = (expenseId, originalType) => {
  billingTypeCache.set(expenseId, originalType);
};

// Função para recuperar tipo original do cache
const getOriginalBillingType = (expenseId, dbType) => {
  // Primeiro, tentar recuperar do cache
  if (billingTypeCache.has(expenseId)) {
    return billingTypeCache.get(expenseId);
  }
  
  // Se não estiver no cache, retornar o tipo do banco
  return dbType;
};

const getExpenseAmount = (expense) => {
  return Number(expense?.amount ?? expense?.value ?? 0) || 0;
};

const resolveUserTableId = async (authUser) => {
  if (!authUser?.id && !authUser?.email) {
    throw new Error('Usuário autenticado inválido para mapear dashboard');
  }

  let userRecord = null;
  let userError = null;

  if (authUser?.id) {
    const response = await supabase
      .from('users')
      .select('id, email, auth_user_id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    userRecord = response.data;
    userError = response.error;
  }

  if ((!userRecord || userError) && authUser?.email) {
    const response = await supabase
      .from('users')
      .select('id, email, auth_user_id')
      .eq('email', authUser.email)
      .maybeSingle();

    userRecord = response.data;
    userError = response.error;
  }

  if (userError) {
    throw userError;
  }

  if (!userRecord?.id) {
    throw new Error('Usuário não encontrado na tabela users para a dashboard');
  }

  return Number(userRecord.id);
};

// Middleware de autenticação usando apenas Supabase Auth
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token não fornecido' 
    });
  }

  try {
    // Verificar o token com o Supabase Auth
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('🔍 DEBUG - Erro ao verificar token com Supabase:', error?.message || 'Usuário não encontrado');
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido: ' + (error?.message || 'Usuário não encontrado')
      });
    }
    
    // Usar o UUID do Supabase Auth diretamente
    req.userId = user.id;
    req.user = user;
    console.log('✅ Usuário autenticado via Supabase:', { 
      userId: user.id, 
      email: user.email
    });
    next();
  } catch (error) {
    console.error('🔍 DEBUG - Erro ao verificar token:', error.message);
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido: ' + error.message 
    });
  }
};

// ===== USERS =====

// GET /api/users
router.get('/users', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Requisição GET /api/users recebida');
    const query = getQuery(req);
    const result = await query(
      'SELECT id, email, name as full_name, role, avatar_url, is_active, created_at, updated_at FROM users WHERE is_active = 1 ORDER BY created_at DESC'
    );
    
    console.log('📋 Usuários encontrados:', result.rows?.length || 0);
    
    // Mapear roles para nomes em português
    const users = (result.rows || []).map(user => ({
      ...user,
      position: user.role === 'admin' ? 'Administrador' : user.role === 'user' ? 'Web Designer' : user.role
    }));
    
    console.log('📋 Enviando resposta com usuários:', users.length);
    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/users/:id
router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT id, email, full_name, position, avatar_url, is_active, created_at, updated_at FROM users WHERE id = ? AND is_active = true',
      [req.params.id]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/users/change-password-by-email
router.put('/users/change-password-by-email', authenticateToken, async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const bcrypt = require('bcryptjs');

    console.log('🔍 Iniciando alteração de senha para:', email);

    if (!email || !newPassword) {
      console.log('❌ Email ou senha não fornecidos');
      return res.status(400).json({ error: 'Email e nova senha são obrigatórios' });
    }

    // Buscar usuário por email no Supabase
    console.log('🔍 Buscando usuário no Supabase...');
    const { data: users, error: searchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .eq('is_active', true);

    console.log('🔍 Resultado da busca:', users);

    if (searchError) {
      console.error('❌ Erro ao buscar usuário:', searchError);
      return res.status(500).json({ error: 'Erro ao buscar usuário' });
    }

    if (!users || users.length === 0) {
      console.log('❌ Usuário não encontrado');
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = users[0];
    console.log('✅ Usuário encontrado:', user);

    // Hash da nova senha
    console.log('🔍 Gerando hash da nova senha...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('✅ Hash gerado:', hashedPassword);

    // Atualizar senha no Supabase
    console.log('🔍 Atualizando senha no Supabase...');
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({ 
        password: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select();

    console.log('🔍 Resultado da atualização:', updateData);

    if (updateError) {
      console.error('❌ Erro ao atualizar senha:', updateError);
      return res.status(500).json({ error: 'Erro ao atualizar senha' });
    }

    if (!updateData || updateData.length === 0) {
      console.log('❌ Nenhuma linha foi atualizada');
      return res.status(500).json({ error: 'Erro ao atualizar senha' });
    }

    console.log(`🔐 Senha alterada com sucesso para o usuário: ${email}`);
    res.json({ message: 'Senha alterada com sucesso', email: user.email });
  } catch (error) {
    console.error('Erro ao alterar senha por email:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/users/:id
router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { full_name, position, avatar_url, is_active, role, name } = req.body;
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // Verificar se o usuário existe
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', req.params.id)
      .single();
    
    if (checkError || !existingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Construir objeto de atualização
    const updateData = {};
    if (full_name !== undefined) updateData.name = full_name;
    if (name !== undefined) updateData.name = name;
    if (position !== undefined) updateData.position = position;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (role !== undefined) updateData.role = role;
    
    // Atualizar usuário diretamente no Supabase
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar usuário no Supabase:', error);
      return res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/users
router.post('/users', authenticateToken, async (req, res) => {
  try {
    const { 
      email, 
      password_hash, 
      full_name, 
      position, 
      bio
    } = req.body;
    const query = getQuery(req);
    
    if (!email || !password_hash) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Verificar se o email já existe
    const existingUserResult = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUserResult.rows && existingUserResult.rows.length > 0) {
      return res.status(409).json({ error: 'Este email já está em uso' });
    }

    // Validar parâmetros obrigatórios
    if (!email || !password_hash || !full_name || !position) {
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios ausentes',
        missing: {
          email: !email,
          password_hash: !password_hash,
          full_name: !full_name,
          position: !position
        }
      });
    }

    // Mapear position para role do banco de dados
    const roleMapping = {
      'Administrador': 'admin',
      'Web Designer': 'user'
    };
    const dbRole = roleMapping[position] || 'user';

    // Hash da senha se não estiver hasheada
    const bcrypt = require('bcryptjs');
    const hashedPassword = (password_hash && password_hash.startsWith('$2')) ? password_hash : await bcrypt.hash(password_hash, 10);

    // Inserir novo usuário
    const insertResult = await query(
      `INSERT INTO users (
        email, password_hash, name, role, is_active
      ) VALUES (?, ?, ?, ?, true)`,
      [
        email, hashedPassword, full_name, dbRole
      ]
    );
    
    // Buscar o usuário inserido pelo email (já que a tabela usa UUID)
    const result = await query(
      'SELECT id, email, full_name, position, bio, avatar_url, is_active, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ error: 'Erro ao criar usuário' });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/users/:id
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    await query(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Usuário desativado com sucesso' });
  } catch (error) {
    console.error('Erro ao desativar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== PROJECTS =====

// GET /api/projects
router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar projetos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/projects/:id
router.get('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/projects
router.post('/projects', authenticateToken, async (req, res) => {
  try {
    const { name, client, project_type, status, description, project_value, paid_value, delivery_date, completion_date } = req.body;
    const query = getQuery(req);
    
    if (!name) {
      return res.status(400).json({ error: 'Nome do projeto é obrigatório' });
    }
    
    await query(
      `INSERT INTO projects (user_id, name, client, project_type, status, description, project_value, paid_value, delivery_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [req.userId, name, client, project_type, status || 'active', description, project_value, paid_value || 0, delivery_date]
    );
    
    const result = await query(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/projects/:id
router.put('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { name, client, project_type, status, description, project_value, paid_value, delivery_date, completion_date } = req.body;
    const query = getQuery(req);
    
    // Converter data para formato MySQL se fornecida
    let formattedDate = delivery_date;
    if (delivery_date && delivery_date !== null) {
      const date = new Date(delivery_date);
      if (!isNaN(date.getTime())) {
        formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else {
        formattedDate = null;
      }
    }
    
    // Converter completion_date para formato MySQL se fornecida
    let formattedCompletionDate = completion_date;
    if (completion_date && completion_date !== null) {
      const date = new Date(completion_date);
      if (!isNaN(date.getTime())) {
        formattedCompletionDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else {
        formattedCompletionDate = null;
      }
    }
    
    // Converter undefined para null para evitar erro do MySQL
    const params = [
      name ?? null,
      client ?? null, 
      project_type ?? null,
      status ?? null,
      description ?? null,
      project_value ?? null,
      paid_value ?? null,
      formattedDate ?? null,
      formattedCompletionDate ?? null,
      req.params.id,
      req.userId
    ];
    
    await query(
       `UPDATE projects 
        SET name = COALESCE(?, name),
            client = COALESCE(?, client),
            project_type = COALESCE(?, project_type),
            status = COALESCE(?, status),
            description = COALESCE(?, description),
            project_value = COALESCE(?, project_value),
            paid_value = COALESCE(?, paid_value),
            delivery_date = COALESCE(?, delivery_date),
            completion_date = COALESCE(?, completion_date),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
       params
     );
    
    const result = await query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/projects/:id
router.delete('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    await query(
      'DELETE FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    res.json({ message: 'Projeto excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== EXPENSES =====



// GET /api/expenses
router.get('/expenses', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT e.id, e.description, e.amount, e.amount, e.category, e.date, 
              e.billing_type, e.project_id, e.user_id, e.notes, e.created_at, e.updated_at,
              p.name as project_name 
       FROM expenses e 
       LEFT JOIN projects p ON e.project_id = p.id 
       WHERE e.user_id = ? 
       ORDER BY e.date DESC`,
      [req.userId]
    );
    
    // 🔧 CALCULAR VALOR MENSAL e RECUPERAR TIPO ORIGINAL para cada despesa
    // Obter ano e mês dos filtros ou usar atual como fallback
    const { startDate, endDate } = req.query;
    let targetYear, targetMonth;
    
    if (startDate) {
      const filterDate = new Date(startDate);
      targetYear = filterDate.getFullYear();
      targetMonth = filterDate.getMonth() + 1;
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }
    
    const expensesWithMonthlyValue = (result.rows || []).map(expense => {
      // 🔧 TEMPORÁRIO: Recuperar tipo original do cache
      const originalBillingType = getOriginalBillingType(expense.id, expense.billing_type);
      
      let monthlyValue = expense.amount;
      
      // Usar tipo original para calcular valor mensal
      switch (originalBillingType) {
        case 'semanal':
          // Usar função que calcula corretamente as ocorrências do dia da semana no mês
          monthlyValue = calculateMonthlyAmount(
            expense.amount,
            'semanal',
            expense.date,
            targetYear,
            targetMonth
          );
          break;
        case 'anual':
          monthlyValue = expense.amount / 12;
          break;
        case 'mensal':
          monthlyValue = expense.amount;
          break;
        case 'unica':
        default:
          monthlyValue = expense.amount; // Para despesas únicas, valor mensal = valor total
          break;
      }
      
      return {
        ...expense,
        billing_type: originalBillingType, // 🔧 TEMPORÁRIO: Retornar tipo original
        monthly_value: parseFloat(monthlyValue.toFixed(2))
      };
    });
    
    res.json(expensesWithMonthlyValue);
  } catch (error) {
    console.error('Erro ao buscar despesas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/expenses/:id
router.get('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT e.id, e.description, e.amount, e.amount, e.category, e.date, 
              e.billing_type, e.project_id, e.user_id, e.notes, e.created_at, e.updated_at,
              p.name as project_name 
       FROM expenses e 
       LEFT JOIN projects p ON e.project_id = p.id 
       WHERE e.id = ? AND e.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }
    
    // 🔧 CALCULAR VALOR MENSAL e RECUPERAR TIPO ORIGINAL para a despesa
    const expense = result.rows[0];
    
    // Obter ano e mês dos filtros ou usar atual como fallback
    const { startDate, endDate } = req.query;
    let targetYear, targetMonth;
    
    if (startDate) {
      const filterDate = new Date(startDate);
      targetYear = filterDate.getFullYear();
      targetMonth = filterDate.getMonth() + 1;
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }
    
    // 🔧 TEMPORÁRIO: Recuperar tipo original do cache
    const originalBillingType = getOriginalBillingType(expense.id, expense.billing_type);
    
    let monthlyValue = expense.amount;
        
        // Usar tipo original para calcular valor mensal
        switch (originalBillingType) {
          case 'semanal':
            // Usar função que calcula corretamente as ocorrências do dia da semana no mês
            monthlyValue = calculateMonthlyAmount(
              expense.amount,
              'semanal',
              expense.date,
              targetYear,
              targetMonth
            );
            break;
          case 'anual':
            monthlyValue = expense.amount / 12;
            break;
          case 'mensal':
            monthlyValue = expense.amount;
            break;
          case 'unica':
          default:
            monthlyValue = expense.amount; // Para despesas únicas, valor mensal = valor total
            break;
        }
    
    const expenseWithMonthlyValue = {
      ...expense,
      billing_type: originalBillingType, // 🔧 TEMPORÁRIO: Retornar tipo original
      monthly_value: parseFloat(monthlyValue.toFixed(2))
    };
    
    res.json(expenseWithMonthlyValue);
  } catch (error) {
    console.error('Erro ao buscar despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});



// POST /api/expenses
router.post('/expenses', authenticateToken, async (req, res) => {
  try {
    
    const { 
      project_id, 
      description, 
      amount, 
      value, // 🔧 ADICIONAR: aceitar tanto 'amount' quanto 'value'
      category, 
      date,
      billing_type,
      notes,
      status
    } = req.body;
    const query = getQuery(req);
    
    // 🔧 CORREÇÃO: aceitar tanto 'amount' quanto 'value' do frontend
    const amountValue = amount !== undefined ? amount : value;
    
    if (!description || amountValue === undefined || amountValue === null) {
      return res.status(400).json({ error: 'Descrição e valor são obrigatórios' });
    }
    
    // Converter amount para número se for string
    const numericAmount = typeof amountValue === 'string' ? parseFloat(amountValue) : amountValue;
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Valor deve ser um número válido maior que zero' });
    }
    
    // Verificar se o projeto pertence ao usuário (apenas se project_id foi fornecido)
    if (project_id) {
      const projectResult = await query(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?',
        [project_id, req.userId]
      );
      
      if (!projectResult.rows || projectResult.rows.length === 0) {
        return res.status(403).json({ error: 'Projeto não encontrado ou não autorizado' });
      }
    }
    
    // 🔧 NOVO: Salvar tipo de cobrança original e calcular valor mensal
    // Calcular valor mensal baseado na frequência usando função precisa
    const expenseDate = date || new Date().toISOString().split('T')[0];
    const monthlyValue = calculateMonthlyAmount(
      numericAmount,
      billing_type,
      expenseDate
    );
    
    // 🔧 TEMPORÁRIO: Mapear tipos para constraint atual até migrações serem aplicadas
    const mappedBillingType = mapBillingTypeForDatabase(billing_type);
    
    console.log(`🔧 TIPO ORIGINAL: ${billing_type}`);
    console.log(`🔧 TIPO MAPEADO (temporário): ${mappedBillingType}`);
    console.log(`🔧 VALOR ORIGINAL: R$ ${numericAmount}`);
    console.log(`🔧 VALOR MENSAL CALCULADO: R$ ${monthlyValue.toFixed(2)}`);
    
    const insertResult = await query(
      `INSERT INTO expenses (
        description, value, category, date, billing_type, project_id, user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        description, 
        numericAmount, 
        category || null, 
        date || new Date().toISOString().split('T')[0],
        mappedBillingType,  // 🔧 TEMPORÁRIO: Usar tipo mapeado até migrações
        project_id || null,
        req.userId,
        notes || null
      ]
    );
    
    // Buscar a despesa recém-criada pelo ID
    const expenseId = insertResult.insertId || insertResult.lastInsertRowid;
    console.log(`🔧 DEBUG: insertResult:`, insertResult);
    console.log(`🔧 DEBUG: ID da despesa criada: ${expenseId}`);
    const result = await query(
      `SELECT e.*, p.name as project_name 
       FROM expenses e 
       LEFT JOIN projects p ON e.project_id = p.id 
       WHERE e.id = ?`,
      [expenseId]
    );
    
    console.log(`🔧 DEBUG: Despesa retornada do banco:`, result.rows[0]);
    
    // 🔧 TEMPORÁRIO: Armazenar tipo original no cache
    const finalExpenseId = expenseId || result.rows[0]?.id;
    storeOriginalType(finalExpenseId, billing_type);
    console.log(`🔧 CACHE: Tipo original '${billing_type}' armazenado para despesa ID ${finalExpenseId}`);
    
    // 🔧 TEMPORÁRIO: Adicionar dados calculados na resposta até migrações serem aplicadas
    const expenseWithCalculatedData = {
      ...result.rows[0],
      billing_type: billing_type, // Retornar tipo original
      monthly_value: parseFloat(monthlyValue.toFixed(2)) // Retornar valor mensal calculado
    };
    
    console.log(`🔧 DEBUG: Resposta final:`, expenseWithCalculatedData);
    
    res.status(201).json(expenseWithCalculatedData);
  } catch (error) {
    console.error('Erro ao criar despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/expenses/:id
router.put('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { description, amount, category, date, billing_type, notes } = req.body;
    const query = getQuery(req);
    
    // Verificar se a despesa existe e pertence ao usuário
    const expenseCheck = await query(
      `SELECT id FROM expenses WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!expenseCheck.rows || expenseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }
    
    // Converter amount para número se fornecido
    const numericAmount = amount !== undefined ? 
      (typeof amount === 'string' ? parseFloat(amount) : amount) : undefined;
    
    // Validar amount se fornecido
    if (numericAmount !== undefined && (isNaN(numericAmount) || numericAmount <= 0)) {
      return res.status(400).json({ error: 'Valor deve ser um número válido maior que zero' });
    }
    
    await query(
      `UPDATE expenses 
       SET description = COALESCE(?, description),
           value = COALESCE(?, value),
           category = COALESCE(?, category),
           date = COALESCE(?, date),
           billing_type = COALESCE(?, billing_type),
           notes = COALESCE(?, notes),
           updated_at = ?
       WHERE id = ?`,
      [
        description !== undefined ? description : null,
        numericAmount !== undefined ? numericAmount : null,
        category !== undefined ? category : null,
        date !== undefined ? date : null,
        billing_type !== undefined ? billing_type : null,
        notes !== undefined ? notes : null,
        new Date().toISOString(),
        req.params.id
      ]
    );
    
    // Buscar a despesa atualizada com dados do projeto
    const result = await query(
      `SELECT e.id, e.description, e.amount, e.amount, e.category, e.date, 
              e.billing_type, e.project_id, e.user_id, e.notes, e.created_at, e.updated_at,
              p.name as project_name 
       FROM expenses e 
       LEFT JOIN projects p ON e.project_id = p.id 
       WHERE e.id = ?`,
      [req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/expenses/:id
router.delete('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    // Verificar se a despesa pertence ao usuário
    const expenseCheck = await query(
      `SELECT e.id FROM expenses e 
       LEFT JOIN projects p ON e.project_id = p.id 
       WHERE e.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!expenseCheck.rows || expenseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }
    
    await query(
      'DELETE FROM expenses WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Despesa excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== PARCELS =====

// GET /api/parcels
router.get('/parcels', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT pa.*, p.name as project_name 
       FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY pa.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar parcelas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/parcels/:id
router.get('/parcels/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT pa.*, p.name as project_name 
       FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/parcels
router.post('/parcels', authenticateToken, async (req, res) => {
  try {
    const { project_id, name, area, soil_type, coordinates } = req.body;
    const query = getQuery(req);
    
    if (!project_id || !name) {
      return res.status(400).json({ error: 'Projeto e nome são obrigatórios' });
    }
    
    // Verificar se o projeto pertence ao usuário
    const projectResult = await query(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [project_id, req.userId]
    );
    
    if (!projectResult.rows || projectResult.rows.length === 0) {
      return res.status(403).json({ error: 'Projeto não encontrado ou não autorizado' });
    }
    
    await query(
      `INSERT INTO parcels (project_id, name, area, soil_type, coordinates, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [project_id, name, area, soil_type, coordinates]
    );
    
    const result = await query(
      `SELECT pa.*, p.name as project_name 
       FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY pa.created_at DESC LIMIT 1`,
      [req.userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/parcels/:id
router.put('/parcels/:id', authenticateToken, async (req, res) => {
  try {
    const { name, area, soil_type, coordinates } = req.body;
    const query = getQuery(req);
    
    // Verificar se a parcela pertence ao usuário
    const parcelCheck = await query(
      `SELECT pa.id FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!parcelCheck.rows || parcelCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    // Tratar valores undefined como null
    const params = [
      name !== undefined ? name : null,
      area !== undefined ? area : null,
      soil_type !== undefined ? soil_type : null,
      coordinates !== undefined ? coordinates : null,
      req.params.id
    ];
    
    await query(
      `UPDATE parcels 
       SET name = COALESCE(?, name),
           area = COALESCE(?, area),
           soil_type = COALESCE(?, soil_type),
           coordinates = COALESCE(?, coordinates),
           updated_at = NOW()
       WHERE id = ?`,
      params
    );
    
    const result = await query(
      `SELECT pa.*, p.name as project_name 
       FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/parcels/:id
router.delete('/parcels/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    // Verificar se a parcela pertence ao usuário
    const parcelCheck = await query(
      `SELECT pa.id FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!parcelCheck.rows || parcelCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    await query(
      'DELETE FROM parcels WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Parcela excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== CROPS =====

// GET /api/crops
router.get('/crops', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT c.*, pa.name as parcel_name, p.name as project_name 
       FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY c.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar culturas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/crops/:id
router.get('/crops/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT c.*, pa.name as parcel_name, p.name as project_name 
       FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE c.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Cultura não encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar cultura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/crops
router.post('/crops', authenticateToken, async (req, res) => {
  try {
    const { parcel_id, name, variety, planting_date, expected_harvest_date, status } = req.body;
    const query = getQuery(req);
    
    if (!parcel_id || !name) {
      return res.status(400).json({ error: 'Parcela e nome são obrigatórios' });
    }
    
    // Verificar se a parcela pertence ao usuário
    const parcelResult = await query(
      `SELECT pa.id FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [parcel_id, req.userId]
    );
    
    if (!parcelResult.rows || parcelResult.rows.length === 0) {
      return res.status(403).json({ error: 'Parcela não encontrada ou não autorizada' });
    }
    
    await query(
      `INSERT INTO crops (parcel_id, name, variety, planting_date, expected_harvest_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [parcel_id, name, variety, planting_date, expected_harvest_date, status || 'planted']
    );
    
    const result = await query(
      `SELECT c.*, pa.name as parcel_name, p.name as project_name 
       FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY c.created_at DESC LIMIT 1`,
      [req.userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar cultura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/crops/:id
router.put('/crops/:id', authenticateToken, async (req, res) => {
  try {
    const { name, variety, planting_date, expected_harvest_date, status } = req.body;
    const query = getQuery(req);
    
    // Verificar se a cultura pertence ao usuário
    const cropCheck = await query(
      `SELECT c.id FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE c.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!cropCheck.rows || cropCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cultura não encontrada' });
    }
    
    // Tratar valores undefined como null
    const params = [
      name !== undefined ? name : null,
      variety !== undefined ? variety : null,
      planting_date !== undefined ? planting_date : null,
      expected_harvest_date !== undefined ? expected_harvest_date : null,
      status !== undefined ? status : null,
      req.params.id
    ];
    
    await query(
      `UPDATE crops 
       SET name = COALESCE(?, name),
           variety = COALESCE(?, variety),
           planting_date = COALESCE(?, planting_date),
           expected_harvest_date = COALESCE(?, expected_harvest_date),
           status = COALESCE(?, status),
           updated_at = NOW()
       WHERE id = ?`,
      params
    );
    
    const result = await query(
      `SELECT c.*, pa.name as parcel_name, p.name as project_name 
       FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE c.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar cultura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/crops/:id
router.delete('/crops/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    // Verificar se a cultura pertence ao usuário
    const cropCheck = await query(
      `SELECT c.id FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE c.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!cropCheck.rows || cropCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cultura não encontrada' });
    }
    
    await query(
      'DELETE FROM crops WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Cultura excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir cultura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/dashboard/stats - Buscar estatísticas do dashboard
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const { startDate, endDate, previousStartDate, previousEndDate, targetYear } = req.query;
    const dashboardUserId = await resolveUserTableId(req.user);
    
    console.log('Backend - Filtros recebidos:', {
      startDate,
      endDate,
      previousStartDate,
      previousEndDate,
      targetYear,
      authUserId: req.userId,
      dashboardUserId
    });
    
    // Se não há filtros de data, usar período atual (mês atual)
    const currentStart = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const currentEnd = endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
    
    // Período anterior (mês anterior)
    const prevStart = previousStartDate || new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
    const prevEnd = previousEndDate || new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];
    
    console.log('Backend - Datas calculadas:', {
      currentStart,
      currentEnd,
      prevStart,
      prevEnd
    });
    
    // Período atual para consultas SQL
    console.log({
      currentStart,
      currentEnd,
      'Tipo currentStart': typeof currentStart,
      'Tipo currentEnd': typeof currentEnd
    });
    
    console.log('Dashboard Stats - User ID:', dashboardUserId);
    
    // Buscar estatísticas de projetos considerando valor pago na criação e restante na entrega
    // Calcular separadamente projetos criados e entregues no período
    const projectStatsCreated = await query(
      `SELECT 
        COUNT(*) as created_projects,
        COALESCE(SUM(project_value), 0) as created_project_value,
        COALESCE(SUM(paid_value), 0) as created_paid_value,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as created_active,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as created_completed,
        COUNT(CASE WHEN status = 'paused' THEN 1 END) as created_paused
       FROM projects 
       WHERE user_id = $1 AND DATE(created_at) BETWEEN $2 AND $3`,
      [dashboardUserId, currentStart, currentEnd]
    );
    
    const projectStatsDelivered = await query(
      `SELECT 
        COUNT(*) as delivered_projects,
        COALESCE(SUM(project_value - paid_value), 0) as delivered_paid_value
       FROM projects 
       WHERE user_id = $1 AND status = 'completed' AND completion_date IS NOT NULL AND DATE(completion_date) BETWEEN $2 AND $3 AND DATE(created_at) NOT BETWEEN $2 AND $3`,
      [dashboardUserId, currentStart, currentEnd]
    );
    
    // Combinar estatísticas
    const createdStats = projectStatsCreated.rows[0] || {};
    const deliveredStats = projectStatsDelivered.rows[0] || {};
    
    const projectStats = {
      rows: [{
        total_projects: (parseInt(createdStats.created_projects) || 0) + (parseInt(deliveredStats.delivered_projects) || 0),
        active_projects: parseInt(createdStats.created_active) || 0,
        completed_projects: parseInt(createdStats.created_completed) || 0,
        paused_projects: parseInt(createdStats.created_paused) || 0,
        total_project_value: (parseFloat(createdStats.created_project_value) || 0),
        total_paid_value: (parseFloat(createdStats.created_paid_value) || 0) + (parseFloat(deliveredStats.delivered_paid_value) || 0)
      }]
    };
    
    console.log('Project Stats Result:', projectStats);
    
    // Buscar estatísticas de projetos do período anterior considerando valor pago na criação e restante na entrega
    const previousProjectStatsCreated = await query(
      `SELECT 
        COALESCE(SUM(paid_value), 0) as created_paid_value
       FROM projects 
       WHERE user_id = $1 AND DATE(created_at) BETWEEN $2 AND $3`,
      [dashboardUserId, prevStart, prevEnd]
    );
    
    const previousProjectStatsDelivered = await query(
      `SELECT 
        COALESCE(SUM(project_value - paid_value), 0) as delivered_paid_value
       FROM projects 
       WHERE user_id = $1 AND status = 'completed' AND completion_date IS NOT NULL AND DATE(completion_date) BETWEEN $2 AND $3 AND DATE(created_at) NOT BETWEEN $2 AND $3`,
      [dashboardUserId, prevStart, prevEnd]
    );
    
    const previousProjectStats = {
      rows: [{
        total_paid_value: (parseFloat(previousProjectStatsCreated.rows[0]?.created_paid_value) || 0) + 
                         (parseFloat(previousProjectStatsDelivered.rows[0]?.delivered_paid_value) || 0)
      }]
    };
    
    // Buscar TODAS as despesas do usuário (não filtrar por data aqui)
    // O filtro por data será aplicado na função calculateMonthlyAmount
    
    const userIdForExpenses = dashboardUserId;
    
    const { data: currentExpenses, error: currentExpensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userIdForExpenses);
    
    if (currentExpensesError) {
      console.error('Erro ao buscar despesas atuais:', currentExpensesError);
      return res.status(500).json({ error: 'Erro ao buscar despesas atuais' });
    }
    
    // Calcular estatísticas de despesas atuais
    const currentExpensesArray = currentExpenses || [];
    
    // 🔧 CORREÇÃO: Inferir tipos originais baseado nos dados conhecidos
    // Para as despesas existentes, vamos usar uma lógica para detectar o tipo real
    const knownWeeklyExpenses = {
      347: 'semanal' // Ricardo - R$ 500 semanal
    };
    
    currentExpensesArray.forEach(expense => {
      if (knownWeeklyExpenses[expense.id]) {
        storeOriginalType(expense.id, knownWeeklyExpenses[expense.id]);
        console.log(`🔧 CACHE: Tipo inferido '${knownWeeklyExpenses[expense.id]}' para despesa ID ${expense.id}`);
      } else if (expense.billing_type === 'mensal') {
        // Se está como mensal no banco, assumir que é realmente mensal
        storeOriginalType(expense.id, 'mensal');
      }
    });
    
    // Mapear campos para compatibilidade com a função de cálculo
    const mappedExpenses = currentExpensesArray.map(expense => {
      // 🔧 TEMPORÁRIO: Recuperar tipo original do cache
      const originalBillingType = getOriginalBillingType(expense.id, expense.billing_type);
      return {
        amount: getExpenseAmount(expense),
        date: expense.date,
        category: expense.category,
        billing_type: originalBillingType
      };
    });
    console.log('Current Expenses Array:', currentExpensesArray);
    console.log('Mapped Expenses Array:', mappedExpenses);
    // Usar período dos filtros para cálculo correto
    let totalExpensesAmount;
    
    // Calcular despesas do período filtrado
    if (startDate && endDate) {
      // Adicionar horários para parsing correto das datas
      const startWithTime = currentStart.includes('T') ? currentStart : `${currentStart}T00:00:00`;
      const endWithTime = currentEnd.includes('T') ? currentEnd : `${currentEnd}T23:59:59`;
      
      const startDateObj = new Date(startWithTime);
      const endDateObj = new Date(endWithTime);
      
      // Detectar filtro anual: mesmo ano e mês inicial = janeiro (0) e mês final = dezembro (11)
      const isYearlyFilter = startDateObj.getFullYear() === endDateObj.getFullYear() && 
                            startDateObj.getMonth() === 0 && 
                            endDateObj.getMonth() === 11;
      
      if (isYearlyFilter) {
        // Filtro anual - calcular despesas de cada mês individualmente
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // 1-based
        
        // Se o filtro é para o ano atual, calcular apenas até o mês atual
        // Se for ano passado, calcular todos os 12 meses
        const monthsToCalculate = startDateObj.getFullYear() === currentYear ? 
                                currentMonth : 12;
        
        totalExpensesAmount = 0;
        
        // Calcular cada mês individualmente
        const yearToUse = targetYear ? parseInt(targetYear) : startDateObj.getFullYear();
        for (let month = 1; month <= monthsToCalculate; month++) {
          const monthlyExpenses = calculateTotalMonthlyExpenses(
            mappedExpenses,
            yearToUse,
            month
          );
          totalExpensesAmount += monthlyExpenses;
        }
      } else {
        // Período mensal - usar cálculo mensal
        const filterYear = targetYear ? parseInt(targetYear) : startDateObj.getFullYear();
        const filterMonth = startDateObj.getMonth() + 1;
        totalExpensesAmount = calculateTotalMonthlyExpenses(
          mappedExpenses,
          filterYear,
          filterMonth
        );
      }
    } else {
      // Sem filtros - usar mês atual
      const now = new Date();
      const currentYear = targetYear ? parseInt(targetYear) : now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      totalExpensesAmount = calculateTotalMonthlyExpenses(
        mappedExpenses,
        currentYear,
        currentMonth
      );
    }
    console.log('Total de despesas (período filtrado):', totalExpensesAmount);
    console.log('Total Expenses Amount calculated:', totalExpensesAmount);
    
    const expenseStats = {
      total_expenses: currentExpensesArray.length,
      total_expenses_amount: totalExpensesAmount,
      expense_categories: [...new Set(currentExpensesArray.map(e => e.category))].length
    };
    
    // Buscar todas as despesas do usuário para cálculo do período anterior
    const { data: previousExpenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userIdForExpenses);
    
    // Calcular estatísticas de despesas do período anterior
    const previousExpensesArray = (previousExpenses || []).map((expense) => ({
      amount: getExpenseAmount(expense),
      date: expense.date,
      billing_type: getOriginalBillingType(expense.id, expense.billing_type)
    }));
    const prevDate = new Date(prevStart);
    const prevYearToUse = targetYear ? parseInt(targetYear) - 1 : prevDate.getFullYear();
    const previousTotalExpensesAmount = calculateTotalMonthlyExpenses(
      previousExpensesArray,
      prevYearToUse,
      prevDate.getMonth() + 1
    );
    
    const previousExpenseStats = [{
      total_expenses_amount: previousTotalExpensesAmount
    }];
    
    // Buscar todos os projetos do período para calcular faturamento manualmente
    // Separar projetos criados no período (recebem paid_value) e entregues no período (recebem restante)
    // Período atual
    
    // Consulta projetos criados no período
    console.log('  - SQL: SELECT paid_value, created_at as revenue_date FROM projects WHERE user_id = $1 AND DATE(created_at) BETWEEN $2 AND $3');
    console.log('  - Parâmetros:', [dashboardUserId, currentStart, currentEnd]);
    
    const projectsCreatedInPeriod = await query(
      `SELECT 
        paid_value,
        created_at as revenue_date,
        paid_value as period_revenue
       FROM projects 
       WHERE user_id = $1 AND DATE(created_at) BETWEEN $2 AND $3`,
      [dashboardUserId, currentStart, currentEnd]
    );
    
    // Projetos criados no período
    
    // Projetos concluídos no período (usando completion_date)
    const projectsCompletedInPeriod = await query(
      `SELECT 
        (project_value - paid_value) as period_revenue,
        completion_date as revenue_date
       FROM projects 
       WHERE user_id = $1 AND status = 'completed' AND completion_date IS NOT NULL AND DATE(completion_date) BETWEEN $2 AND $3 AND DATE(created_at) NOT BETWEEN $2 AND $3`,
      [dashboardUserId, currentStart, currentEnd]
    );

    // Combinar os resultados
    const allProjectsInPeriod = {
      rows: [
        ...(projectsCreatedInPeriod.rows || []),
        ...(projectsCompletedInPeriod.rows || [])
      ]
    };

    // Calcular faturamento e despesas por mês manualmente
    const monthlyDataMap = new Map();

    // Processar projetos
    const projectsInPeriod = allProjectsInPeriod.rows || [];
    console.log('Projects in period:', projectsInPeriod.length, projectsInPeriod);
    
    projectsInPeriod.forEach(project => {
      if (project.revenue_date && project.period_revenue > 0) {
        const date = new Date(project.revenue_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        console.log('Processing project:', project.period_revenue, 'for month:', monthKey);
        
        if (!monthlyDataMap.has(monthKey)) {
          monthlyDataMap.set(monthKey, { month: monthKey, revenue: 0, expenses: 0 });
        }
        
        monthlyDataMap.get(monthKey).revenue += parseFloat(project.period_revenue) || 0;
      }
    });
    
    // Processar despesas - incluir todas as despesas do usuário com cálculo mensal correto
    // Buscar todas as despesas do usuário para cálculo correto por mês
    const { data: allUserExpenses, error: allExpensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userIdForExpenses);
    
    if (!allExpensesError && allUserExpenses) {
      const mappedAllExpenses = allUserExpenses.map(expense => ({
        amount: getExpenseAmount(expense),
        date: expense.date,
        category: expense.category,
        billing_type: getOriginalBillingType(expense.id, expense.billing_type)
      }));
      
      // Para cada mês no período, calcular despesas usando a função de cálculo mensal
      if (startDate && endDate) {
        const startDateObj = new Date(currentStart);
        const endDateObj = new Date(currentEnd);
        const isYearlyFilter = startDateObj.getFullYear() === endDateObj.getFullYear() && 
                              startDateObj.getMonth() === 0 && 
                              endDateObj.getMonth() === 11;
        
        if (isYearlyFilter) {
          // Para filtro anual, calcular cada mês
          const filterYear = targetYear ? parseInt(targetYear) : startDateObj.getFullYear();
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth() + 1;
          const monthsToCalculate = filterYear === currentYear ? currentMonth : 12;
          
          for (let month = 1; month <= monthsToCalculate; month++) {
            const monthKey = `${filterYear}-${String(month).padStart(2, '0')}`;
            const monthlyExpenses = calculateTotalMonthlyExpenses(
              mappedAllExpenses,
              filterYear,
              month
            );
            
            if (!monthlyDataMap.has(monthKey)) {
              monthlyDataMap.set(monthKey, { month: monthKey, revenue: 0, expenses: 0 });
            }
            monthlyDataMap.get(monthKey).expenses = monthlyExpenses;
          }
        } else {
          // Para filtro mensal
          const filterYear = targetYear ? parseInt(targetYear) : startDateObj.getFullYear();
          const filterMonth = startDateObj.getMonth() + 1;
          const monthKey = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;
          const monthlyExpenses = calculateTotalMonthlyExpenses(
            mappedAllExpenses,
            filterYear,
            filterMonth
          );
          
          if (!monthlyDataMap.has(monthKey)) {
            monthlyDataMap.set(monthKey, { month: monthKey, revenue: 0, expenses: 0 });
          }
          monthlyDataMap.get(monthKey).expenses = monthlyExpenses;
        }
      }
    }
    
    // Converter mapa para array ordenado
    const combinedMonthlyData = Array.from(monthlyDataMap.values())
      .sort((a, b) => a.month.localeCompare(b.month));
    
    // Se não há dados, criar pelo menos um mês atual com zeros
    if (combinedMonthlyData.length === 0) {
      const currentDate = new Date();
      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      combinedMonthlyData.push({ month: currentMonthKey, revenue: 0, expenses: 0 });
    }
    
    // Buscar despesas por categoria do período atual usando Supabase
    const { data: expensesByCategoryRaw, error: categoryError } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userIdForExpenses)
      .gte('date', currentStart)
      .lte('date', currentEnd)
      .order('category');
    
    if (categoryError) {
      console.error('Erro ao buscar despesas por categoria:', categoryError);
      return res.status(500).json({ error: 'Erro ao buscar despesas por categoria' });
    }
    
    // Agrupar e calcular totais mensais por categoria
    const categoryTotals = {};
    const expensesByCategoryArray = expensesByCategoryRaw || [];
    // Mapear dados para compatibilidade
    const mappedCategoryExpenses = expensesByCategoryArray.map(expense => ({
      category: expense.category || 'Sem categoria',
      amount: getExpenseAmount(expense),
      date: expense.date,
      billing_type: getOriginalBillingType(expense.id, expense.billing_type)
    }));
     mappedCategoryExpenses.forEach(expense => {
       let monthlyAmount;
       
       if (startDate && endDate) {
         // Se há filtros de data, usar lógica similar ao cálculo total
         const startDateObj = new Date(currentStart);
         const endDateObj = new Date(currentEnd);
         const daysDiff = (endDateObj - startDateObj) / (1000 * 60 * 60 * 24);
         
         if (daysDiff > 35) {
           // Período longo - usar valor direto
           monthlyAmount = parseFloat(expense.amount || 0);
         } else {
           // Período mensal - usar cálculo mensal
           const filterYear = targetYear ? parseInt(targetYear) : startDateObj.getFullYear();
           const filterMonth = startDateObj.getMonth() + 1;
           monthlyAmount = calculateTotalMonthlyExpenses(
             [expense],
             filterYear,
             filterMonth
           );
         }
       } else {
         // Sem filtros - usar mês atual
         const now = new Date();
         const currentYear = targetYear ? parseInt(targetYear) : now.getFullYear();
         const currentMonth = now.getMonth() + 1;
         monthlyAmount = calculateTotalMonthlyExpenses(
           [expense],
           currentYear,
           currentMonth
         );
       }
       
       if (!categoryTotals[expense.category]) {
         categoryTotals[expense.category] = {
           total_amount: 0,
           count: 0
         };
       }
       
       categoryTotals[expense.category].total_amount += monthlyAmount;
       categoryTotals[expense.category].count += 1;
     });
    
    const expensesByCategory = Object.entries(categoryTotals)
      .map(([category, data]) => ({
        category,
        total: data.total_amount,
        count: data.count
      }))
      .sort((a, b) => b.total - a.total);
    
    // Buscar projetos recentes do período atual
    const recentProjects = await query(
      `SELECT id, name, status, project_value, delivery_date, created_at
       FROM projects 
       WHERE user_id = $1 AND DATE(delivery_date) BETWEEN $2 AND $3
       ORDER BY delivery_date DESC
       LIMIT 5`,
      [dashboardUserId, currentStart, currentEnd]
    );
    
    const currentProjectsRaw = projectStats.rows?.[0] || {
      total_projects: 0,
      active_projects: 0,
      completed_projects: 0,
      paused_projects: 0,
      total_project_value: 0,
      total_paid_value_creation: 0,
      total_completion_revenue: 0
    };
    
    // Converter valores para números
     const currentProjects = {
       total_projects: parseInt(currentProjectsRaw.total_projects) || 0,
       active_projects: parseInt(currentProjectsRaw.active_projects) || 0,
       completed_projects: parseInt(currentProjectsRaw.completed_projects) || 0,
       paused_projects: parseInt(currentProjectsRaw.paused_projects) || 0,
       total_project_value: parseFloat(currentProjectsRaw.total_project_value) || 0,
       total_paid_value: parseFloat(currentProjectsRaw.total_paid_value) || 0
     };
    
    // expenseStats já é um objeto direto, não precisa de [0]
    
    const previousProjectsRaw = previousProjectStats.rows?.[0] || {
      total_paid_value: 0
    };
    
    const previousProjects = {
      total_paid_value: parseFloat(previousProjectsRaw.total_paid_value) || 0
    };
    const previousExpensesStats = previousExpenseStats[0] || { total_expenses_amount: 0 };
    
    // Buscar valores a receber do período atual
    // Considera projetos ativos que ainda não foram concluídos no período
    const currentReceivableStats = await query(
      `SELECT 
        COALESCE(SUM(project_value - paid_value), 0) as total_receivable
       FROM projects 
       WHERE user_id = $1 
       AND status = 'active' 
       AND (completion_date IS NULL OR DATE(completion_date) > $3)`,
      [dashboardUserId, currentStart, currentEnd]
    );
    
    const currentReceivable = Math.max(0, parseFloat(currentReceivableStats.rows?.[0]?.total_receivable || 0));
    
    // Buscar valores a receber do período anterior
    // Considera projetos que estavam ativos no período anterior
    const previousReceivableStats = await query(
      `SELECT 
        COALESCE(SUM(project_value - paid_value), 0) as total_receivable
       FROM projects 
       WHERE user_id = $1 
       AND status = 'active' 
       AND (completion_date IS NULL OR DATE(completion_date) > $3)`,
      [dashboardUserId, prevStart, prevEnd]
    );
    
    const previousReceivable = Math.max(0, parseFloat(previousReceivableStats.rows?.[0]?.total_receivable || 0));

    // Calcular receita (faturamento) diretamente dos projetos do período
    const createdProjectsRevenue = (projectsCreatedInPeriod.rows || []).reduce((sum, project) => {
      return sum + (parseFloat(project.paid_value) || 0);
    }, 0);
    
    const deliveredProjectsRevenue = (projectsCompletedInPeriod.rows || []).reduce((sum, project) => {
      return sum + (parseFloat(project.period_revenue) || 0);
    }, 0);
    
    const currentRevenue = createdProjectsRevenue + deliveredProjectsRevenue;
    
    // Para o período anterior, usar o valor calculado do período anterior
    const previousRevenue = previousProjects.total_paid_value;
    
    const currentExpensesAmount = expenseStats.total_expenses_amount;
    const currentProfit = currentRevenue - currentExpensesAmount;
    
    // Valores calculados para resposta
    console.log('Current Revenue (total_paid_value):', currentRevenue);
    console.log('Previous Revenue:', previousRevenue);
    console.log('Current Expenses Amount:', currentExpensesAmount);
    console.log('Current Profit:', currentProfit);
    console.log('Current Receivable:', currentReceivable);

    const stats = {
      projects: currentProjects,
      expenses: expenseStats,
      current_period: {
         revenue: currentRevenue,
         expenses: currentExpensesAmount,
         receivable: currentReceivable,
         profit: currentProfit,
         total_projects: currentProjects.total_projects,
         total_project_value: currentProjects.total_project_value
       },
      previous_period: {
        revenue: previousRevenue,
        expenses: previousExpensesStats.total_expenses_amount,
        receivable: previousReceivable
      },
      current_receivable: currentReceivable,
      revenue_by_month: combinedMonthlyData,
      expenses_by_category: expensesByCategory || [],
      recent_projects: recentProjects.rows || []
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== BRIEFINGS =====

// GET /api/briefings
router.get('/briefings', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const { search, status, priority } = req.query;
    
    let sql = 'SELECT * FROM briefings WHERE user_id = ?';
    const params = [req.userId];
    
    if (search) {
      sql += ' AND (title LIKE ? OR client LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (priority && priority !== 'all') {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const result = await query(sql, params);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar briefings:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/briefings/:id
router.get('/briefings/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT * FROM briefings WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Briefing não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar briefing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/briefings
router.post('/briefings', authenticateToken, async (req, res) => {
  try {
    const { title, client, description, status, priority, deadline } = req.body;
    
    if (!title || !client) {
      return res.status(400).json({ error: 'Título e cliente são obrigatórios' });
    }
    
    if (status && !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    
    if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Prioridade inválida' });
    }
    
    const query = getQuery(req);
    const result = await query(
      'INSERT INTO briefings (title, client, description, status, priority, deadline, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, client, description, status || 'pending', priority || 'medium', deadline, req.userId]
    );
    
    const newBriefing = await query(
      'SELECT * FROM briefings WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newBriefing.rows[0]);
  } catch (error) {
    console.error('Erro ao criar briefing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/briefings/:id
router.put('/briefings/:id', authenticateToken, async (req, res) => {
  try {
    const { title, client, description, status, priority, deadline } = req.body;
    const query = getQuery(req);
    
    // Verificar se o briefing existe e pertence ao usuário
    const briefingCheck = await query(
      'SELECT id FROM briefings WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    if (!briefingCheck.rows || briefingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Briefing não encontrado' });
    }
    
    if (status && !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    
    if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Prioridade inválida' });
    }
    
    await query(
      `UPDATE briefings 
       SET title = COALESCE(?, title),
           client = COALESCE(?, client),
           description = COALESCE(?, description),
           status = COALESCE(?, status),
           priority = COALESCE(?, priority),
           deadline = COALESCE(?, deadline),
           updated_at = ?
       WHERE id = ?`,
      [
        title !== undefined ? title : null,
        client !== undefined ? client : null,
        description !== undefined ? description : null,
        status !== undefined ? status : null,
        priority !== undefined ? priority : null,
        deadline !== undefined ? deadline : null,
        new Date().toISOString(),
        req.params.id
      ]
    );
    
    const result = await query(
      'SELECT * FROM briefings WHERE id = ?',
      [req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar briefing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/briefings/:id
router.delete('/briefings/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    // Verificar se o briefing pertence ao usuário
    const briefingCheck = await query(
      'SELECT id FROM briefings WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    if (!briefingCheck.rows || briefingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Briefing não encontrado' });
    }
    
    await query(
      'DELETE FROM briefings WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Briefing excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir briefing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== CODES =====

// GET /api/codes
router.get('/codes', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const { search, code_type } = req.query;
    
    let sql = 'SELECT * FROM codes WHERE 1=1';
    const params = [];
    
    if (search) {
      sql += ' AND content LIKE ?';
      params.push(`%${search}%`);
    }
    
    if (code_type && code_type !== 'all') {
      sql += ' AND type = ?';
      params.push(code_type);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const result = await query(sql, params);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar códigos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/codes/:id
router.get('/codes/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT * FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Código não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/codes
router.post('/codes', authenticateToken, async (req, res) => {
  try {
    const { title, language, code_content, description } = req.body;
    
    if (!title || !language || !code_content) {
      return res.status(400).json({ error: 'Título, linguagem e conteúdo do código são obrigatórios' });
    }
    
    if (!['css', 'html', 'javascript'].includes(language)) {
      return res.status(400).json({ error: 'Linguagem de código inválida' });
    }
    
    const query = getQuery(req);
    const result = await query(
      'INSERT INTO codes (title, language, code_content, description, user_id) VALUES (?, ?, ?, ?, ?)',
      [title, language, code_content, description, req.userId]
    );
    
    const newCode = await query(
      'SELECT * FROM codes WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newCode.rows[0]);
  } catch (error) {
    console.error('Erro ao criar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/codes/:id
router.put('/codes/:id', authenticateToken, async (req, res) => {
  try {
    const { title, language, code_content, description } = req.body;
    
    if (!title || !language || !code_content) {
      return res.status(400).json({ error: 'Título, linguagem e conteúdo do código são obrigatórios' });
    }
    
    if (!['css', 'html', 'javascript'].includes(language)) {
      return res.status(400).json({ error: 'Linguagem de código inválida' });
    }
    
    const query = getQuery(req);
    
    // Verificar se o código existe
    const existingCode = await query(
      'SELECT * FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    if (!existingCode.rows || existingCode.rows.length === 0) {
      return res.status(404).json({ error: 'Código não encontrado' });
    }
    
    await query(
      'UPDATE codes SET title = ?, language = ?, code_content = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, language, code_content, description, req.params.id]
    );
    
    const updatedCode = await query(
      'SELECT * FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    res.json(updatedCode.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/codes/:id
router.delete('/codes/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    // Verificar se o código existe
    const existingCode = await query(
      'SELECT * FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    if (!existingCode.rows || existingCode.rows.length === 0) {
      return res.status(404).json({ error: 'Código não encontrado' });
    }
    
    await query(
      'DELETE FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Código excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
