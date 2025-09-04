const { Pool } = require('pg');

// Configuração do banco de dados otimizada para Vercel
let pool;

// Configurar string de conexão com prioridade para dashboard_POSTGRES_URL
let connectionString;
if (process.env.dashboard_POSTGRES_URL) {
  connectionString = process.env.dashboard_POSTGRES_URL;
} else if (process.env.SUPABASE_DATABASE_URL) {
  connectionString = process.env.SUPABASE_DATABASE_URL;
} else {
  // Fallback para variáveis individuais do Supabase
  const host = process.env.SUPABASE_HOST || 'localhost';
  const port = process.env.SUPABASE_PORT || 5432;
  const database = process.env.SUPABASE_DATABASE || 'postgres';
  const user = process.env.SUPABASE_USER || 'postgres';
  const password = process.env.SUPABASE_PASSWORD || '';
  connectionString = `postgres://${user}:${password}@${host}:${port}/${database}`;
}

// Forçar desabilitação completa do SSL com múltiplos parâmetros
const sslParams = 'sslmode=disable&ssl=false&sslcert=&sslkey=&sslrootcert=&sslcrl=&requiressl=false';

if (connectionString.includes('?')) {
  connectionString = connectionString.split('?')[0] + '?' + sslParams;
} else {
  connectionString += '?' + sslParams;
}

console.log('🔗 DB Connection string configurada:', connectionString ? 'Sim' : 'Não');

pool = new Pool({
  connectionString,
  ssl: false,
  max: 1,
  min: 0,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 5000,
  acquireTimeoutMillis: 5000,
});

console.log('✅ Pool de conexão DB criado');

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

// Função auxiliar para formatar datas para MySQL/PostgreSQL
function formatDateForMySQL(dateString) {
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { query, pool, testConnection, transaction, formatDateForMySQL };