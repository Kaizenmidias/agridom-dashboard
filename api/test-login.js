// Versão simplificada para teste no Vercel
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email, password } = req.body || {};

    // Log para debug
    console.log('Teste de login - Body recebido:', { email: email ? 'presente' : 'ausente', password: password ? 'presente' : 'ausente' });
    console.log('Environment variables:', {
      NODE_ENV: process.env.NODE_ENV,
      hasPostgresHost: !!process.env.dashboard_POSTGRES_HOST,
      hasJwtSecret: !!process.env.dashboard_SUPABASE_JWT_SECRET
    });

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Resposta de teste sem conexão com banco
    res.json({
      message: 'Teste de login funcionando',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      received: { email, hasPassword: !!password }
    });
  } catch (error) {
    console.error('Erro no teste de login:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};