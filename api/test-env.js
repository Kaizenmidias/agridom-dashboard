export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.dashboard_SUPABASE_JWT_SECRET,
      hasDbHost: !!process.env.dashboard_SUPABASE_HOST,
      hasDbName: !!process.env.dashboard_SUPABASE_DATABASE,
      hasDbUser: !!process.env.dashboard_SUPABASE_USER,
      hasDbPassword: !!process.env.dashboard_SUPABASE_PASSWORD,
      jwtSecretLength: process.env.dashboard_SUPABASE_JWT_SECRET ? process.env.dashboard_SUPABASE_JWT_SECRET.length : 0
    };

    res.status(200).json({
      message: 'Teste de variáveis de ambiente',
      environment: envVars
    });
  } catch (error) {
    console.error('Erro no teste de env:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}