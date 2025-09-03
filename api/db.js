const mysql = require('mysql2/promise');

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agri_dom',
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
};

// Pool de conexões
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000
});

// Função para executar queries
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return { rows };
  } catch (error) {
    console.error('Erro na query:', error);
    throw error;
  }
}

// Função para testar a conexão
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ Conectado ao MySQL');
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com o MySQL:', error.message);
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