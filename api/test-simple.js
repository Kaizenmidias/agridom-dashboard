// Teste simples sem dependências externas
export default async function handler(req, res) {
  try {
    console.log('Teste simples executando');
    
    // Configuração CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    return res.status(200).json({ 
      message: 'Teste simples funcionando!',
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro no teste simples:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}