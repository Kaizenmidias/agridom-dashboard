const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Configuração do banco de dados para serverless
let pool;

function getPool() {
  if (!pool) {
    console.log('🔗 Configuração de conexão:');
    console.log('- POSTGRES_URL:', process.env.POSTGRES_URL ? 'Definido' : 'Não definido');
    console.log('- SUPABASE_DATABASE_URL:', process.env.SUPABASE_DATABASE_URL ? 'Definido' : 'Não definido');
    console.log('- POSTGRES_HOST:', process.env.POSTGRES_HOST);
    console.log('- POSTGRES_DATABASE:', process.env.POSTGRES_DATABASE);
    console.log('- POSTGRES_USER:', process.env.POSTGRES_USER);
    console.log('- POSTGRES_PASSWORD:', process.env.POSTGRES_PASSWORD ? 'Definido' : 'Não definido');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    
    // Tentar configuração manual sem SSL
    let poolConfig;
    
    if (process.env.POSTGRES_URL) {
      // Usar URL completa mas forçar SSL como false
      const url = new URL(process.env.POSTGRES_URL);
      poolConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1),
        user: url.username,
        password: url.password,
        ssl: false,
        max: 1,
        min: 0,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 5000,
        acquireTimeoutMillis: 5000,
      };
    } else {
      // Configuração manual com variáveis individuais
      poolConfig = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        database: process.env.POSTGRES_DATABASE || 'postgres',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '',
        ssl: false,
        max: 1,
        min: 0,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 5000,
        acquireTimeoutMillis: 5000,
      };
    }
    
    console.log('🔗 Configuração do pool:', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      user: poolConfig.user,
      ssl: poolConfig.ssl
    });
    
    pool = new Pool(poolConfig);
    
    pool.on('connect', (client) => {
      console.log('🔗 Nova conexão estabelecida com sucesso');
    });
    
    pool.on('error', (err, client) => {
      console.error('❌ Erro no pool de conexão:', err.message);
      console.error('❌ Stack do erro:', err.stack);
    });
  }
  return pool;
}

// Função para executar queries
async function query(text, params) {
  console.log('🔍 Executando query:', text.substring(0, 50) + '...');
  console.log('📊 Parâmetros:', params);
  
  try {
    const pool = getPool();
    console.log('🔗 Conectando ao banco...');
    const client = await pool.connect();
    console.log('✅ Cliente conectado');
    
    try {
      const result = await client.query(text, params);
      console.log('✅ Query executada com sucesso');
      return result;
    } finally {
      client.release();
      console.log('🔄 Cliente liberado');
    }
  } catch (error) {
    console.error('❌ Erro na query:', error.message);
    console.error('❌ Stack:', error.stack);
    throw error;
  }
}

module.exports = async function handler(req, res) {
  console.log('🚀 Iniciando função de login...');
  console.log('📝 Método:', req.method);
  console.log('🌐 URL:', req.url);
  
  // Verificar variáveis de ambiente
  console.log('🔧 Variáveis de ambiente:');
  console.log('- POSTGRES_URL:', process.env.POSTGRES_URL ? 'Definida' : 'Não definida');
  console.log('- SUPABASE_JWT_SECRET:', process.env.SUPABASE_JWT_SECRET ? 'Definida' : 'Não definida');
  console.log('- SUPABASE_DATABASE_URL:', process.env.SUPABASE_DATABASE_URL ? 'Definida' : 'Não definida');
  console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Definida' : 'Não definida');
  
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Respondendo OPTIONS');
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    console.log('❌ Método não permitido:', req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('📦 Body da requisição:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Conectar ao banco Supabase real
    console.log('🔍 Fazendo login com banco real:', email);
    
    // Testar conexão com o banco
    console.log('🔗 Testando conexão com banco...');
    try {
      const testPool = getPool();
      console.log('✅ Pool obtido com sucesso');
    } catch (poolError) {
      console.error('❌ Erro ao obter pool:', poolError);
      throw poolError;
    }
    
    // Buscar usuário no banco
    console.log('🔍 Executando query para buscar usuário...');
    const result = await query(
      'SELECT id, email, password, name as full_name, role, can_access_dashboard, can_access_projects, can_access_briefings, can_access_codes, can_access_expenses, can_access_crm, can_access_users FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    console.log('✅ Query executada, resultados:', result.rows ? result.rows.length : 0);

    if (!result.rows || result.rows.length === 0) {
      console.log('❌ Usuário não encontrado:', email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];
    console.log('👤 Usuário encontrado:', user.email, 'Hash:', user.password.substring(0, 20) + '...');

    // Verificar senha
    console.log('🔐 Verificando senha...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔐 Senha válida:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Senha inválida');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token JWT
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    console.log('🔑 JWT Secret:', jwtSecret ? 'Definido' : 'Não definido');
    
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Retornar dados do usuário (sem a senha)
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
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
    console.error('❌ Erro no login:', error.message);
    console.error('❌ Stack completo:', error.stack);
    console.error('❌ Tipo do erro:', error.constructor.name);
    
    // Retornar erro mais específico em desenvolvimento
    const isDev = process.env.NODE_ENV !== 'production';
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      ...(isDev && { 
        details: error.message,
        type: error.constructor.name 
      })
    });
  }
}