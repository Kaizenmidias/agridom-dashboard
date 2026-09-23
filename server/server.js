// Carregar variÃ¡veis de ambiente baseado no NODE_ENV ANTES de qualquer importaÃ§Ã£o
const path = require('path');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const express = require('express');
const cors = require('cors');
const { query, testConnection, closeConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const localOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const corsOptions = {
  origin: (origin, callback) => {
    const productionOrigins = ['https://crm.kaizenmidias.com', process.env.CORS_ORIGIN].filter(Boolean);
    const allowByDefault = !origin;
    const isAllowedLocal = localOriginRegex.test(origin || '');
    const isAllowedProduction = productionOrigins.includes(origin);

    if (
      allowByDefault ||
      (process.env.NODE_ENV === 'production' ? isAllowedProduction : isAllowedLocal || isAllowedProduction)
    ) {
      return callback(null, true);
    }

    return callback(new Error(`Origin nao permitida pelo CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Testar conexÃ£o com o banco de dados na inicializaÃ§Ã£o
testConnection();

// A funÃ§Ã£o query agora vem do mÃ³dulo database.js

// Servir arquivos estÃ¡ticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importar rotas
const authRoutes = require('./routes/auth');
const crudRoutes = require('./routes/crud');
const uploadRoutes = require('./routes/upload');
const prospectionRoutes = require('./routes/prospection');
const prospectingRoutes = require('./routes/prospecting');
const commercialEntityRoutes = require('./routes/commercial-entities');


app.locals.query = query;


// Usar rotas
app.use('/api/auth', authRoutes);
app.use('/api', crudRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/prospection', prospectionRoutes);
app.use('/api/prospecting', prospectingRoutes);
app.use('/api/commercial', commercialEntityRoutes);


// Rota de teste
app.get('/api/health', async (req, res) => {
  try {
    // Usar testConnection que jÃ¡ estÃ¡ implementada corretamente
    const isConnected = await testConnection();
    if (isConnected) {
      res.json({ status: 'OK', message: 'ConexÃ£o com banco de dados funcionando' });
    } else {
      res.status(500).json({ status: 'ERROR', message: 'Erro na conexÃ£o com banco de dados' });
    }
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Erro na conexÃ£o com banco de dados' });
  }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

module.exports = app;

if (require.main === module) {
  // Iniciar servidor apenas no ambiente Node tradicional.
  const server = app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`API disponÃ­vel em ${process.env.NODE_ENV === 'production' ? process.env.BACKEND_URL : `http://localhost:${PORT}`}/api`);
    console.log(`ðŸŒ Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });

  // Configurar timeout para produÃ§Ã£o
  if (process.env.NODE_ENV === 'production') {
    server.timeout = 30000; // 30 segundos
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nðŸ”„ Encerrando servidor...');
    await closeConnection();
    process.exit(0);
  });
}
