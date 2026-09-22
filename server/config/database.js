const mysql = require('mysql2/promise');

let pool;

const normalizeBooleanParam = (value) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
};

const normalizeParams = (params = []) => params.map(normalizeBooleanParam);

const convertNumberedPlaceholders = (sql, params = []) => {
  const usedIndexes = [];
  const text = sql.replace(/\$(\d+)/g, (_match, index) => {
    usedIndexes.push(Number(index) - 1);
    return '?';
  });

  if (!usedIndexes.length) {
    return { text, params: normalizeParams(params) };
  }

  return {
    text,
    params: normalizeParams(usedIndexes.map((index) => params[index])),
  };
};

const normalizeSql = (sql) => {
  return sql
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\btrue\b/gi, '1')
    .replace(/\bfalse\b/gi, '0');
};

const getPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      database: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      queueLimit: 0,
      timezone: 'Z',
    };
  }

  return {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'kaizen_crm',
    user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    timezone: 'Z',
  };
};

function getPool() {
  if (!pool) {
    const config = getPoolConfig();
    pool = mysql.createPool(config);

    console.log('Conexao MySQL configurada:', {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
    });
  }

  return pool;
}

async function query(sql, params = []) {
  const start = Date.now();
  const converted = convertNumberedPlaceholders(normalizeSql(sql), params);

  try {
    const [rows, fields] = await getPool().execute(converted.text, converted.params);
    const rowCount = Array.isArray(rows) ? rows.length : rows.affectedRows || 0;

    if (process.env.NODE_ENV === 'development') {
      console.log('Executed MySQL query:', {
        duration: Date.now() - start,
        rows: rowCount,
      });
    }

    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount,
      fields,
      insertId: rows?.insertId,
      affectedRows: rows?.affectedRows,
    };
  } catch (error) {
    console.error('Database query error:', {
      message: error.message,
      sql: converted.text,
    });
    throw error;
  }
}

async function testConnection() {
  try {
    await query('SELECT 1 AS ok');
    return true;
  } catch (error) {
    console.error('Erro ao conectar com o MySQL:', error.message);
    return false;
  }
}

async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Conexao MySQL fechada');
  }
}

module.exports = {
  query,
  testConnection,
  closeConnection,
  getPool,
};
