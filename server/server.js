const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

// Carregar variáveis de ambiente baseado no NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: envFile });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CORS_ORIGIN || 'https://seudominio.com'
    : ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agri_dom',
  port: process.env.DB_PORT || 3306
};

// Pool de conexões
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importar rotas
const authRoutes = require('./routes/auth');
const crudRoutes = require('./routes/crud');
const uploadRoutes = require('./routes/upload');

// Disponibilizar a função query para as rotas
app.locals.query = query;

// Usar rotas
app.use('/api/auth', authRoutes);
app.use('/api', crudRoutes);
app.use('/api/upload', uploadRoutes);

// Rota de teste
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'OK', message: 'Conexão com banco de dados funcionando' });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Erro na conexão com banco de dados' });
  }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 API disponível em ${process.env.NODE_ENV === 'production' ? process.env.BACKEND_URL : `http://localhost:${PORT}`}/api`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// Configurar timeout para produção
if (process.env.NODE_ENV === 'production') {
  server.timeout = 30000; // 30 segundos
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Fechando servidor...');
  await pool.end();
  process.exit(0);
});