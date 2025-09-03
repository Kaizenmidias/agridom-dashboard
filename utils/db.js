const { Pool } = require('pg');

// Configuração do banco de dados
let pool;
let isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Configuração para Supabase em produção
  const connectionString = process.env.dashboard_POSTGRES_URL || 
    `postgresql://${process.env.dashboard_POSTGRES_USER || 'postgres'}:${process.env.dashboard_POSTGRES_PASSWORD}@${process.env.dashboard_POSTGRES_HOST}:5432/${process.env.dashboard_POSTGRES_DATABASE || 'postgres'}`;
  
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
} else {
  // Configuração para desenvolvimento usando Supabase
  if (process.env.dashboard_POSTGRES_HOST && process.env.dashboard_POSTGRES_HOST.includes('supabase.co')) {
    // Usar string de conexão para Supabase
    const connectionString = `postgresql://${process.env.dashboard_POSTGRES_USER}:${process.env.dashboard_POSTGRES_PASSWORD}@${process.env.dashboard_POSTGRES_HOST}:5432/${process.env.dashboard_POSTGRES_DATABASE}?sslmode=require`;
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  } else {
    // Configuração local
    pool = new Pool({
      host: process.env.dashboard_POSTGRES_HOST || 'localhost',
      port: 5432,
      database: process.env.dashboard_POSTGRES_DATABASE || 'agridom_dev',
      user: process.env.dashboard_POSTGRES_USER || 'postgres',
      password: process.env.dashboard_POSTGRES_PASSWORD || '',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
}

// Função para executar queries
async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
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
    const client = await pool.connect();
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
  const client = await pool.connect();
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

module.exports = {
  query,
  pool,
  testConnection,
  transaction
};