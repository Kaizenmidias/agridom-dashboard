require('dotenv').config();
const http = require('http');
const handler = require('./index.js');

const PORT = process.env.PORT || 3001;

const server = http.createServer(async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('Erro no servidor:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Erro interno do servidor' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor API rodando na porta ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
});