export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('🔍 [API] Request received:', req.method, req.url);
  console.log('🔍 [API] Body:', req.body);

  // Rota de teste simples
  if (req.url === '/api/test-login') {
    if (req.method === 'POST') {
      return res.status(200).json({ 
        success: true, 
        message: 'API funcionando!',
        body: req.body 
      });
    }
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Rota de login simples
  if (req.url === '/api/login') {
    if (req.method === 'POST') {
      const { email, password } = req.body || {};
      
      if (email === 'agenciakaizendesign@gmail.com' && password === '123456') {
        return res.status(200).json({ 
          success: true,
          token: 'fake-token-for-test',
          user: { email, name: 'Usuário Teste' }
        });
      }
      
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  return res.status(404).json({ error: 'Rota não encontrada' });
}