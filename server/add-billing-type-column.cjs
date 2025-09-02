require('dotenv').config();
const mysql = require('mysql2/promise');

async function addBillingTypeColumn() {
  let connection;
  
  try {
    // Conectar ao banco de dados
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'dashboard'
    });
    
    console.log('Conectado ao banco de dados MariaDB');
    
    // Verificar se a coluna billing_type já existe
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'billing_type'",
      [process.env.DB_NAME || 'dashboard']
    );
    
    if (columns.length > 0) {
      console.log('Coluna billing_type já existe na tabela expenses');
      return;
    }
    
    // Adicionar a coluna billing_type
    await connection.execute(`
      ALTER TABLE expenses 
      ADD COLUMN billing_type ENUM('unica', 'semanal', 'mensal', 'anual') DEFAULT 'unica' AFTER amount
    `);
    console.log('Coluna billing_type adicionada com sucesso à tabela expenses');
    
    // Adicionar outras colunas relacionadas ao billing se não existirem
    try {
      await connection.execute(`
        ALTER TABLE expenses 
        ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE AFTER billing_type
      `);
      console.log('Coluna is_recurring adicionada');
    } catch (error) {
      console.log('Coluna is_recurring já existe ou erro:', error.message);
    }
    
    try {
      await connection.execute(`
        ALTER TABLE expenses 
        ADD COLUMN recurring_day_of_week INT NULL AFTER is_recurring
      `);
      console.log('Coluna recurring_day_of_week adicionada');
    } catch (error) {
      console.log('Coluna recurring_day_of_week já existe ou erro:', error.message);
    }
    
    try {
      await connection.execute(`
        ALTER TABLE expenses 
        ADD COLUMN recurring_end_date DATE NULL AFTER recurring_day_of_week
      `);
      console.log('Coluna recurring_end_date adicionada');
    } catch (error) {
      console.log('Coluna recurring_end_date já existe ou erro:', error.message);
    }
    
    try {
      await connection.execute(`
        ALTER TABLE expenses 
        ADD COLUMN original_expense_id VARCHAR(36) NULL AFTER recurring_end_date
      `);
      console.log('Coluna original_expense_id adicionada');
    } catch (error) {
      console.log('Coluna original_expense_id já existe ou erro:', error.message);
    }
    
    try {
      await connection.execute(`
        ALTER TABLE expenses 
        ADD COLUMN notes TEXT NULL AFTER original_expense_id
      `);
      console.log('Coluna notes adicionada');
    } catch (error) {
      console.log('Coluna notes já existe ou erro:', error.message);
    }
    
    console.log('Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Conexão com o banco de dados fechada');
    }
  }
}

addBillingTypeColumn();