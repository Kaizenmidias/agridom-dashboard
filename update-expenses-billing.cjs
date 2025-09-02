const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateExpensesTable() {
  let connection;
  
  try {
    // Criar conexão com o banco
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'agri_dom'
    });

    console.log('Conectado ao banco de dados MariaDB');

    // Adicionar campos para tipo de cobrança
    console.log('Adicionando campos para tipo de cobrança...');
    
    await connection.execute(`
      ALTER TABLE expenses 
      ADD COLUMN billing_type ENUM('unica', 'semanal', 'mensal', 'anual') DEFAULT 'unica' AFTER notes
    `);
    console.log('Campo billing_type adicionado');
    
    await connection.execute(`
      ALTER TABLE expenses 
      ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE AFTER billing_type
    `);
    console.log('Campo is_recurring adicionado');
    
    await connection.execute(`
      ALTER TABLE expenses 
      ADD COLUMN recurring_day_of_week TINYINT NULL COMMENT 'Dia da semana para cobrança semanal (0=Domingo, 1=Segunda, etc.)' AFTER is_recurring
    `);
    console.log('Campo recurring_day_of_week adicionado');
    
    await connection.execute(`
      ALTER TABLE expenses 
      ADD COLUMN recurring_end_date DATE NULL COMMENT 'Data final para recorrência (opcional)' AFTER recurring_day_of_week
    `);
    console.log('Campo recurring_end_date adicionado');
    
    await connection.execute(`
      ALTER TABLE expenses 
      ADD COLUMN original_expense_id CHAR(36) NULL COMMENT 'ID da despesa original para despesas recorrentes' AFTER recurring_end_date
    `);
    console.log('Campo original_expense_id adicionado');

    // Adicionar índices
    console.log('Adicionando índices...');
    
    await connection.execute('CREATE INDEX idx_expenses_billing_type ON expenses(billing_type)');
    console.log('Índice idx_expenses_billing_type criado');
    
    await connection.execute('CREATE INDEX idx_expenses_recurring ON expenses(is_recurring)');
    console.log('Índice idx_expenses_recurring criado');
    
    await connection.execute('CREATE INDEX idx_expenses_recurring_day ON expenses(recurring_day_of_week)');
    console.log('Índice idx_expenses_recurring_day criado');
    
    await connection.execute('CREATE INDEX idx_expenses_original_id ON expenses(original_expense_id)');
    console.log('Índice idx_expenses_original_id criado');

    // Adicionar foreign key
    await connection.execute(`
      ALTER TABLE expenses 
      ADD CONSTRAINT fk_expenses_original 
      FOREIGN KEY (original_expense_id) REFERENCES expenses(id) ON DELETE SET NULL
    `);
    console.log('Foreign key fk_expenses_original adicionada');

    console.log('\n✅ Tabela expenses atualizada com sucesso!');
    console.log('Novos campos adicionados:');
    console.log('- billing_type: Tipo de cobrança (única, semanal, mensal, anual)');
    console.log('- is_recurring: Se a despesa é recorrente');
    console.log('- recurring_day_of_week: Dia da semana para cobrança semanal');
    console.log('- recurring_end_date: Data final da recorrência');
    console.log('- original_expense_id: Referência à despesa original');

  } catch (error) {
    console.error('Erro ao atualizar tabela expenses:', error.message);
    
    // Se o erro for que a coluna já existe, não é um problema
    if (error.message.includes('Duplicate column name')) {
      console.log('⚠️  Alguns campos já existem na tabela. Continuando...');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('Conexão com o banco encerrada');
    }
  }
}

updateExpensesTable();