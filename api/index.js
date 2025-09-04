// Handler principal simplificado para teste
module.exports = async function handler(req, res) {
  try {
    // Configurar CORS básico
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Resposta básica para qualquer requisição
    return res.status(200).json({ 
      message: 'API funcionando - versão simplificada',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      query: req.query
    });

  } catch (error) {
    console.error('Erro no handler:', error.message);
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};