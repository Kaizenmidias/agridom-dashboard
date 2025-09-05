const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configurar CORS
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' 
    ? 'https://agridom-dashboard.vercel.app' 
    : 'http://localhost:3000'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Handler para login
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário no Supabase
    console.log('Tentando buscar usuário:', email);
    const { data: users, error: queryError } = await supabase
      .from('users')
      .select('id, email, password, name, role, avatar_url, is_active, can_access_dashboard, can_access_projects, can_access_briefings, can_access_codes, can_access_expenses, can_access_crm, can_access_users')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    console.log('Resultado da consulta:', { users, queryError });

    if (queryError || !users) {
      console.log('Erro na consulta ou usuário não encontrado:', queryError);
      return res.status(401).json({ 
        error: 'Credenciais inválidas',
        debug: process.env.NODE_ENV === 'development' ? { queryError, users } : undefined
      });
    }

    const user = users;

    // Verificar senha usando SHA256 + salt (mesmo método usado para gerar os hashes)
    const crypto = require('crypto');
    const hashedPassword = crypto.createHash('sha256').update(password + 'agridom_salt').digest('hex');
    const isValidPassword = hashedPassword === user.password;
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token JWT
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
    
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Retornar dados do usuário (sem a senha)
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar_url: user.avatar_url,
      is_active: user.is_active,
      permissions: {
        can_access_dashboard: user.can_access_dashboard,
        can_access_projects: user.can_access_projects,
        can_access_briefings: user.can_access_briefings,
        can_access_codes: user.can_access_codes,
        can_access_expenses: user.can_access_expenses,
        can_access_crm: user.can_access_crm,
        can_access_users: user.can_access_users
      }
    };

    res.json({ 
      message: 'Login realizado com sucesso',
      user: authUser, 
      token 
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Handler para verificação de token
async function handleVerify(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';

    // Verificar e decodificar o token
    const decoded = jwt.verify(token, jwtSecret);
    
    // Buscar usuário atualizado no banco
    const { data: user, error: queryError } = await supabase
      .from('users')
      .select('id, email, name, role, avatar_url, is_active, can_access_dashboard, can_access_projects, can_access_briefings, can_access_codes, can_access_expenses, can_access_crm, can_access_users')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (queryError || !user) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    // Retornar dados do usuário
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar_url: user.avatar_url,
      is_active: user.is_active,
      permissions: {
        can_access_dashboard: user.can_access_dashboard,
        can_access_projects: user.can_access_projects,
        can_access_briefings: user.can_access_briefings,
        can_access_codes: user.can_access_codes,
        can_access_expenses: user.can_access_expenses,
        can_access_crm: user.can_access_crm,
        can_access_users: user.can_access_users
      }
    };

    res.json({ 
      message: 'Token válido',
      user: authUser
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    
    console.error('Erro na verificação do token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Handler para debug de variáveis de ambiente
async function handleDebug(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL ? process.env.SUPABASE_URL : 'NOT_SET',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
    JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT_SET',
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ? 'SET' : 'NOT_SET',
    supabaseConnection: supabaseUrl && supabaseKey ? 'CONFIGURED' : 'NOT_CONFIGURED'
  };

  res.json({ envVars });
}

// Handler para testar conexão com Supabase
async function handleTestDB(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar se a tabela 'users' existe
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_info');

    // Teste de conexão básica
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    // Buscar usuário específico
    const { data: lucasUser, error: lucasError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'lucas@agridom.com.br')
      .single();

    // Verificar todas as tabelas disponíveis
    const { data: allTables, error: allTablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    res.json({
      status: 'SUCCESS',
      connection: 'OK',
      totalUsers: users ? users.length : 0,
      users: users || {},
      lucasUser,
      lucasError,
      usersError,
      allTables,
      allTablesError
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      connection: 'FAILED',
      error: error.message
    });
  }
}

// Função principal que roteia as requisições
}

// Handler para listar tabelas do banco
async function handleTables(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Tentar diferentes formas de listar tabelas
    const queries = [];
    
    // Query 1: Verificar se tabela users existe diretamente
    try {
      const { data: usersCheck, error: usersError } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true });
      queries.push({ name: 'users_table_check', data: usersCheck, error: usersError });
    } catch (e) {
      queries.push({ name: 'users_table_check', error: e.message });
    }

    // Query 2: Listar via pg_tables
    try {
      const { data: pgTables, error: pgError } = await supabase
        .rpc('exec_sql', { query: 'SELECT tablename FROM pg_tables WHERE schemaname = \'public\';' });
      queries.push({ name: 'pg_tables', data: pgTables, error: pgError });
    } catch (e) {
      queries.push({ name: 'pg_tables', error: e.message });
    }

    // Query 3: Verificar schema
    try {
      const { data: schema, error: schemaError } = await supabase
        .rpc('exec_sql', { query: 'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';' });
      queries.push({ name: 'information_schema', data: schema, error: schemaError });
    } catch (e) {
      queries.push({ name: 'information_schema', error: e.message });
    }

    res.json({
      status: 'SUCCESS',
      queries
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req;
  
  // Roteamento baseado na URL
  if (url.includes('/api/auth/login') || url.includes('/auth/login') || url.includes('/api/login')) {
    return handleLogin(req, res);
  } else if (url.includes('/api/auth/verify') || url.includes('/auth/verify') || url.includes('/api/verify')) {
    return handleVerify(req, res);
  } else if (url.includes('/api/debug') || url.includes('/debug')) {
    return handleDebug(req, res);
  } else if (url.includes('/api/testdb') || url.includes('/testdb')) {
    return handleTestDB(req, res);
  } else if (url.includes('/api/tables') || url.includes('/tables')) {
    return handleTables(req, res);
  } else {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
}