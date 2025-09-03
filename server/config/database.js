const { Pool } = require('pg');

// Configuração do banco de dados
let pool;
let isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Configuração para Supabase em produção
  pool = new Pool({
    host: process.env.dashboard_POSTGRES_HOST,
    port: 5432,
    database: process.env.dashboard_POSTGRES_DATABASE,
    user: process.env.dashboard_POSTGRES_USER,
    password: process.env.dashboard_POSTGRES_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  // Configuração para desenvolvimento usando Supabase
  pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
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
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Conexão com o banco de dados estabelecida:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com o banco de dados:', error.message);
    return false;
  }
}

// Função para fechar a conexão
async function closeConnection() {
  try {
    await pool.end();
    console.log('🔌 Conexão com o banco de dados fechada');
  } catch (error) {
    console.error('Erro ao fechar conexão:', error);
  }
}

module.exports = {
  query,
  testConnection,
  closeConnection,
  pool
};