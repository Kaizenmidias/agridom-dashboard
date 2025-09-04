const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho para o banco SQLite
const dbPath = path.join(__dirname, '..', 'database.sqlite');

let db;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erro ao conectar com SQLite:', err.message);
      } else {
        console.log('✅ Conectado ao banco SQLite');
        
        // Criar tabela users se não existir
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'Web Designer',
            avatar_url TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            can_access_dashboard BOOLEAN DEFAULT 1,
            can_access_briefings BOOLEAN DEFAULT 0,
            can_access_codes BOOLEAN DEFAULT 0,
            can_access_projects BOOLEAN DEFAULT 0,
            can_access_expenses BOOLEAN DEFAULT 0,
            can_access_crm BOOLEAN DEFAULT 0,
            can_access_users BOOLEAN DEFAULT 0
          )
        `, (err) => {
          if (err) {
            console.error('❌ Erro ao criar tabela users:', err.message);
          } else {
            console.log('✅ Tabela users criada/verificada');
          }
        });
        
        // Criar tabela projects se não existir
        db.run(`
          CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            client TEXT,
            project_type TEXT DEFAULT 'website',
            status TEXT DEFAULT 'active',
            description TEXT,
            project_value REAL,
            paid_value REAL DEFAULT 0,
            delivery_date DATE,
            completion_date DATE,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            console.error('❌ Erro ao criar tabela projects:', err.message);
          } else {
            console.log('✅ Tabela projects criada/verificada');
          }
        });
        
        // Criar tabela expenses se não existir
        db.run(`
          CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            value REAL NOT NULL,
            category TEXT,
            date DATE NOT NULL,
            expense_date DATE,
            billing_type TEXT DEFAULT 'one_time',
            project_id INTEGER,
            user_id INTEGER NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            console.error('❌ Erro ao criar tabela expenses:', err.message);
          } else {
            console.log('✅ Tabela expenses criada/verificada');
          }
        });
        
        // Criar tabela codes se não existir
        db.run(`
          CREATE TABLE IF NOT EXISTS codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            language TEXT NOT NULL,
            code_content TEXT NOT NULL,
            description TEXT,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            console.error('❌ Erro ao criar tabela codes:', err.message);
          } else {
            console.log('✅ Tabela codes criada/verificada');
          }
        });
      }
    });
  }
  return db;
}

// Função para executar queries com Promise
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve({ rows });
        }
      });
    } else {
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            rows: [], 
            rowCount: this.changes,
            insertId: this.lastID 
          });
        }
      });
    }
  });
}

module.exports = {
  getDatabase,
  query
};