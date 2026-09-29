const mysql = require('mysql2/promise');

let pool;

const normalizeBooleanParam = (value) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
};

const normalizeParams = (params = []) => params.map(normalizeBooleanParam);

class DatabaseUndefinedBindError extends TypeError {
  constructor(params) {
    const undefinedIndexes = params.reduce((indexes, value, index) => value === undefined ? [...indexes, index] : indexes, []);
    super('Bind parameters must not contain undefined. To pass SQL NULL specify JS null');
    this.name = 'DatabaseUndefinedBindError';
    this.code = 'DATABASE_UNDEFINED_BIND';
    this.undefinedIndexes = undefinedIndexes;
    this.parameterCount = params.length;
    Error.captureStackTrace?.(this, DatabaseUndefinedBindError);
  }
}

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
    const originalPoolExecute = pool.execute.bind(pool);
    pool.execute = (sql, params, ...rest) => originalPoolExecute(sql, assertNoUndefinedExecuteParams(params || []), ...rest);
    const originalGetConnection = pool.getConnection.bind(pool);
    pool.getConnection = async (...args) => {
      const connection = await originalGetConnection(...args);
      const originalConnectionExecute = connection.execute.bind(connection);
      connection.execute = (sql, params, ...rest) => originalConnectionExecute(sql, assertNoUndefinedExecuteParams(params || []), ...rest);
      return connection;
    };

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

function assertNoUndefinedExecuteParams(params = []) {
  const normalized = normalizeParams(params);
  if (normalized.some((value) => value === undefined)) throw new DatabaseUndefinedBindError(normalized);
  return normalized;
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
    console.log('[MySQL] Conexão fechada');
  }
}

module.exports = {
  query,
  testConnection,
  closeConnection,
  getPool,
  DatabaseUndefinedBindError,
  assertNoUndefinedExecuteParams,
};
