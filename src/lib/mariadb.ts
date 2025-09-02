import mysql from 'mysql2/promise';

// Configuração do pool de conexões MariaDB
const pool = mysql.createPool({
  host: import.meta.env.VITE_DB_HOST || 'localhost',
  port: parseInt(import.meta.env.VITE_DB_PORT || '3306'),
  database: import.meta.env.VITE_DB_NAME || 'agri_dom',
  user: import.meta.env.VITE_DB_USER || 'root',
  password: import.meta.env.VITE_DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 20, // máximo de conexões no pool
  queueLimit: 0,
  acquireTimeout: 60000, // tempo limite para obter conexão
  timeout: 60000, // tempo limite para queries
  reconnect: true,
  charset: 'utf8mb4'
});

// Função para executar queries
export const query = async (sql: string, params?: any[]) => {
  try {
    const [rows, fields] = await pool.execute(sql, params);
    return {
      rows: rows as any[],
      rowCount: Array.isArray(rows) ? rows.length : 0,
      command: sql.trim().split(' ')[0].toUpperCase(),
      fields
    };
  } catch (error) {
    throw error;
  }
};

// Função para executar transações
export const transaction = async (callback: (connection: mysql.PoolConnection) => Promise<any>) => {
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
};

// Função para verificar conexão
export const checkConnection = async () => {
  try {
    const result = await query('SELECT NOW() as now');
    return { success: true, timestamp: result.rows[0].now };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
};

// Função para fechar o pool (útil para testes)
export const closePool = async () => {
  await pool.end();
};

// Exportar o pool para uso direto se necessário
export { pool };

// Tipos para facilitar o uso
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  fields?: any[];
}

export interface DatabaseError extends Error {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
  sql?: string;
}