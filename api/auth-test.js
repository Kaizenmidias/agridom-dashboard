// Função de teste simples para verificar se o problema é na estrutura básica
export default async function handler(req, res) {
  try {
    console.log('Teste básico da função serverless');
    
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Resposta simples
    return res.status(200).json({ 
      message: 'Função serverless funcionando',
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro na função de teste:', error);
    return res.status(500).json({ 
      error: 'Erro interno',
      message: error.message 
    });
  }
}