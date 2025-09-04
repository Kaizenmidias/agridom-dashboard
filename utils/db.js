const { Pool } = require('pg');

// Configuração do banco de dados otimizada para Vercel
let pool;

// Usar variáveis da integração automática do Supabase na Vercel
const connectionString = process.env.dashboard_POSTGRES_URL || 
  process.env.SUPABASE_DATABASE_URL || 
  `postgresql://${process.env.SUPABASE_DB_USER}:${process.env.SUPABASE_DB_PASSWORD}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`;

console.log('🔗 DB Connection string configurada:', connectionString ? 'Sim' : 'Não');

pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
    ca: false,
    checkServerIdentity: () => undefined,
    secureProtocol: 'TLSv1_2_method'
  },
  max: 10, // Reduzido para serverless
  min: 0,  // Sem conexões mínimas para serverless
  idleTimeoutMillis: 5000, // 5 segundos para serverless
  connectionTimeoutMillis: 10000,
  acquireTimeoutMillis: 10000,
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