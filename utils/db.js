const { Pool } = require('pg');

// Configuração do banco de dados otimizada para Vercel
let pool;

function getPool() {
  if (!pool) {
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
    
    pool = new Pool(poolConfig);
    
    pool.on('error', (err, client) => {
      console.error('❌ Erro no pool de conexão (utils/db):', err.message);
    });
    
    console.log('✅ Pool de conexão DB criado');
  }
  return pool;
}

// Função para executar queries
async function query(text, params = []) {
  const start = Date.now();
  try {
    const currentPool = getPool();
    const res = await currentPool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Função para testar a conexão
async function testConnection() {
  try {
    const currentPool = getPool();
    const client = await currentPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Conectado ao PostgreSQL/Supabase');
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com o PostgreSQL/Supabase:', error.message);
    return false;
  }
}

// Função para iniciar transação PostgreSQL
async function transaction(callback) {
  const currentPool = getPool();
  const client = await currentPool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Função auxiliar para formatar datas para MySQL/PostgreSQL
function formatDateForMySQL(dateString) {
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { query, pool: getPool, testConnection, transaction, formatDateForMySQL };