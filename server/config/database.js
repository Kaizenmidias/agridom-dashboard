const { Pool } = require('pg');
const sqlite = require('./sqlite');

// Configuração do banco de dados
let pool;
let useSQLite = false;

function getPool() {
  if (!pool && !useSQLite) {
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
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
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
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };
    }
    
    console.log('🔗 Configuração do pool (server):', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      user: poolConfig.user,
      ssl: poolConfig.ssl
    });
    
    pool = new Pool(poolConfig);
    
    pool.on('error', (err, client) => {
      console.error('❌ Erro inesperado no cliente do banco:', err);
      console.log('🔄 Tentando usar SQLite como fallback...');
      useSQLite = true;
      pool = null;
    });
    
    // Testar conexão
    pool.connect((err, client, release) => {
      if (err) {
        console.error('❌ Erro ao conectar PostgreSQL:', err.message);
        console.log('🔄 Usando SQLite como fallback...');
        useSQLite = true;
        pool = null;
        return;
      }
      release();
      console.log('✅ Server Pool de conexão PostgreSQL criado');
    });
  }
  
  if (useSQLite) {
    console.log('📱 Usando SQLite como banco de dados');
    return {
      query: sqlite.query,
      connect: (callback) => callback(null, {}, () => {}),
      end: () => Promise.resolve()
    };
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
    if (pool) {
      await pool.end();
      pool = null;
      console.log('🔌 Conexão com o banco de dados fechada');
    }
  } catch (error) {
    console.error('Erro ao fechar conexão:', error);
  }
}

module.exports = {
  query,
  testConnection,
  closeConnection,
  getPool
};