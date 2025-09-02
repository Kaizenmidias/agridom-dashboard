const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Conectar ao banco de dados
const dbPath = path.join(__dirname, 'dashboard.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Inicializando banco de dados SQLite...');

// Criar tabela users
db.serialize(() => {
  // Criar tabela users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      position VARCHAR(255),
      bio TEXT,
      avatar VARCHAR(255),
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      can_access_dashboard BOOLEAN DEFAULT 1,
      can_access_briefings BOOLEAN DEFAULT 1,
      can_access_codes BOOLEAN DEFAULT 1,
      can_access_projects BOOLEAN DEFAULT 1,
      can_access_expenses BOOLEAN DEFAULT 1,
      can_access_crm BOOLEAN DEFAULT 1,
      can_access_users BOOLEAN DEFAULT 0
    )
  `, (err) => {
    if (err) {
      console.error('❌ Erro ao criar tabela users:', err);
    } else {
      console.log('✅ Tabela users criada/verificada!');
    }
  });

  // Verificar se já existe um admin
  db.get("SELECT * FROM users WHERE email = 'admin@agridom.com'", (err, row) => {
    if (err) {
      console.error('❌ Erro ao verificar admin:', err);
      return;
    }

    if (!row) {
      // Criar usuário admin
      const adminPassword = bcrypt.hashSync('admin123', 10);
      
      db.run(`
        INSERT INTO users (
          email, password, full_name, position, is_active,
          can_access_dashboard, can_access_briefings, can_access_codes,
          can_access_projects, can_access_expenses, can_access_crm, can_access_users
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'admin@agridom.com',
        adminPassword,
        'Administrador',
        'Administrador do Sistema',
        1, 1, 1, 1, 1, 1, 1, 1
      ], (err) => {
        if (err) {
          console.error('❌ Erro ao criar admin:', err);
        } else {
          console.log('✅ Usuário admin criado!');
          console.log('📧 Email: admin@agridom.com');
          console.log('🔑 Senha: admin123');
        }
      });
    } else {
      console.log('✅ Usuário admin já existe!');
    }

    // Verificar se já existe o usuário Ricardo
    db.get("SELECT * FROM users WHERE email = 'ricardo@agridom.com'", (err, row) => {
      if (err) {
        console.error('❌ Erro ao verificar Ricardo:', err);
        return;
      }

      if (!row) {
        // Criar usuário Ricardo
        const ricardoPassword = bcrypt.hashSync('ricardo123', 10);
        
        db.run(`
          INSERT INTO users (
            email, password, full_name, position, is_active,
            can_access_dashboard, can_access_briefings, can_access_codes,
            can_access_projects, can_access_expenses, can_access_crm, can_access_users
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          'ricardo@agridom.com',
          ricardoPassword,
          'Ricardo Silva',
          'Analista',
          1, 1, 1, 1, 1, 1, 1, 0
        ], (err) => {
          if (err) {
            console.error('❌ Erro ao criar Ricardo:', err);
          } else {
            console.log('✅ Usuário Ricardo criado!');
            console.log('📧 Email: ricardo@agridom.com');
            console.log('🔑 Senha: ricardo123');
          }
          
          db.close((err) => {
            if (err) {
              console.error('❌ Erro ao fechar banco:', err);
            } else {
              console.log('✅ Banco de dados inicializado com sucesso!');
            }
          });
        });
      } else {
        console.log('✅ Usuário Ricardo já existe!');
        
        db.close((err) => {
          if (err) {
            console.error('❌ Erro ao fechar banco:', err);
          } else {
            console.log('✅ Banco de dados verificado com sucesso!');
          }
        });
      }
    });
  });
});