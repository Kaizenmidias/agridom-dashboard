require('dotenv').config();
const mysql = require('mysql2/promise');

async function updateProjectsTable() {
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
    
    // Remover colunas antigas que não são mais necessárias
    try {
      await connection.execute('ALTER TABLE projects DROP COLUMN location');
      console.log('Coluna location removida');
    } catch (error) {
      console.log('Coluna location não existe ou já foi removida');
    }
    
    try {
      await connection.execute('ALTER TABLE projects DROP COLUMN total_area');
      console.log('Coluna total_area removida');
    } catch (error) {
      console.log('Coluna total_area não existe ou já foi removida');
    }
    
    try {
      await connection.execute('ALTER TABLE projects DROP COLUMN budget');
      console.log('Coluna budget removida');
    } catch (error) {
      console.log('Coluna budget não existe ou já foi removida');
    }
    
    try {
      await connection.execute('ALTER TABLE projects DROP COLUMN start_date');
      console.log('Coluna start_date removida');
    } catch (error) {
      console.log('Coluna start_date não existe ou já foi removida');
    }
    
    try {
      await connection.execute('ALTER TABLE projects DROP COLUMN end_date');
      console.log('Coluna end_date removida');
    } catch (error) {
      console.log('Coluna end_date não existe ou já foi removida');
    }
    
    // Adicionar novas colunas
    try {
      await connection.execute('ALTER TABLE projects ADD COLUMN client VARCHAR(255) AFTER name');
      console.log('Coluna client adicionada');
    } catch (error) {
      console.log('Coluna client já existe');
    }
    
    try {
      await connection.execute('ALTER TABLE projects ADD COLUMN project_type VARCHAR(100) AFTER client');
      console.log('Coluna project_type adicionada');
    } catch (error) {
      console.log('Coluna project_type já existe');
    }
    
    try {
      await connection.execute('ALTER TABLE projects ADD COLUMN project_value DECIMAL(12, 2) AFTER description');
      console.log('Coluna project_value adicionada');
    } catch (error) {
      console.log('Coluna project_value já existe');
    }
    
    try {
      await connection.execute('ALTER TABLE projects ADD COLUMN paid_value DECIMAL(12, 2) DEFAULT 0 AFTER project_value');
      console.log('Coluna paid_value adicionada');
    } catch (error) {
      console.log('Coluna paid_value já existe');
    }
    
    try {
      await connection.execute('ALTER TABLE projects ADD COLUMN delivery_date DATE AFTER paid_value');
      console.log('Coluna delivery_date adicionada');
    } catch (error) {
      console.log('Coluna delivery_date já existe');
    }
    
    // Atualizar enum do status
    try {
      await connection.execute("ALTER TABLE projects MODIFY COLUMN status ENUM('active', 'completed', 'paused', 'cancelled') DEFAULT 'active'");
      console.log('Enum status atualizado');
    } catch (error) {
      console.log('Erro ao atualizar enum status:', error.message);
    }
    
    console.log('\nTabela projects atualizada com sucesso!');
    
  } catch (error) {
    console.error('Erro ao atualizar tabela:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateProjectsTable();