const { Pool } = require('pg');

// Configuração do banco de dados
let pool;

// Configurar string de conexão com prioridade para dashboard_POSTGRES_URL
let connectionString;
if (process.env.dashboard_POSTGRES_URL) {
  connectionString = process.env.dashboard_POSTGRES_URL;
} else if (process.env.SUPABASE_DATABASE_URL) {
  connectionString = process.env.SUPABASE_DATABASE_URL;
} else {
  // Fallback para variáveis individuais do Supabase
  const host = process.env.dashboard_POSTGRES_HOST || 'localhost';
  const port = process.env.dashboard_POSTGRES_PORT || 5432;
  const database = process.env.dashboard_POSTGRES_DATABASE || 'postgres';
  const user = process.env.dashboard_POSTGRES_USER || 'postgres';
  const password = process.env.dashboard_POSTGRES_PASSWORD || '';
  connectionString = `postgres://${user}:${password}@${host}:${port}/${database}`;
}

// Desabilitar SSL completamente para resolver certificados autoassinados
if (!connectionString.includes('sslmode')) {
  const separator = connectionString.includes('?') ? '&' : '?';
  connectionString += `${separator}sslmode=disable`;
}

console.log('🔗 Server DB Connection string configurada:', connectionString ? 'Sim' : 'Não');

pool = new Pool({
  connectionString,
  ssl: false,
  max: 20,
  min: 0,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  acquireTimeoutMillis: 10000,
});

console.log('✅ Server Pool de conexão DB criado');

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