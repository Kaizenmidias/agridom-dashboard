const { Pool } = require('pg');

// Configuração do banco de dados
let pool;
let isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Configuração para Supabase em produção
  pool = new Pool({
    host: process.env.SUPABASE_DB_HOST || 'db.rxvcvlegxljinevhmbyk.supabase.co',
    port: process.env.SUPABASE_DB_PORT || 5432,
    database: process.env.SUPABASE_DB_NAME || 'postgres',
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD || 'KJ4E7xKy0SCEVIX7',
    ssl: {
      rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  // Configuração para desenvolvimento usando Supabase
  if (process.env.DB_HOST && process.env.DB_HOST.includes('supabase.co')) {
    // Usar string de conexão para Supabase
    const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=require`;
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
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'agridom_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
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