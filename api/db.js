const { Pool } = require('pg');

// Configuração do banco de dados
let pool;
let isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Configuração para Supabase em produção
  const connectionString = process.env.dashboard_POSTGRES_URL || 
    `postgresql://${process.env.dashboard_POSTGRES_USER || 'postgres'}:${process.env.dashboard_POSTGRES_PASSWORD || 'KJ4E7xKy0SCEVIX7'}@${process.env.dashboard_POSTGRES_HOST || 'db.rxvcvlegxljinevhmbyk.supabase.co'}:5432/${process.env.dashboard_POSTGRES_DATABASE || 'postgres'}?sslmode=disable`;
  
  pool = new Pool({
    connectionString,
    ssl: false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
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

// Função para iniciar transação
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Função helper para escapar valores
function escape(value) {
  return mysql.escape(value);
}

// Função helper para formatar datas para MySQL
function formatDateForMySQL(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  query,
  pool,
  testConnection,
  transaction,
  escape,
  formatDateForMySQL
};