export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req;
  
  if (url.includes('/api/simple-test')) {
    return res.json({ 
      message: 'Teste simples funcionando', 
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
  }
  
  return res.status(404).json({ error: 'Rota não encontrada', url: req.url });
}