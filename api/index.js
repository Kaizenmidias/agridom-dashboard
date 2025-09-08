// API simplificada para debug
module.exports = async function handler(req, res) {
  try {
    // Configuração CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('🔍 [API] Request received:', req.method, req.url);
    console.log('🔍 [API] Environment variables:', {
      NODE_ENV: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasJwtSecret: !!process.env.JWT_SECRET
    });

    // Rota de teste simples
    if (req.url === '/api/test' || req.url === '/api/test-login' || req.url === '/api/test-env') {
      return res.status(200).json({ 
        success: true, 
        message: 'API funcionando!',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
          JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT_SET'
        }
      });
    }

    // Parse do body para POST requests
    let body = {};
    if (req.method === 'POST') {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString();
        body = rawBody ? JSON.parse(rawBody) : {};
      } catch (parseError) {
        console.log('Erro ao fazer parse do body:', parseError);
        body = {};
      }
    }

    // Rota de login simplificada
    if (req.url === '/api/login' || req.url === '/api/auth/login' || req.url === '/auth/login') {
      if (req.method === 'POST') {
        try {
          const { email, password } = body;
          
          console.log('Login attempt:', { email, hasPassword: !!password });
          
          if (!email || !password) {
            return res.status(400).json({
              success: false,
              message: 'Email e senha são obrigatórios',
              received: { email: !!email, password: !!password }
            });
          }

          // Credenciais válidas
          const validCredentials = [
            { email: 'agenciakaizendesign@gmail.com', password: '123456' },
            { email: 'test@test.com', password: 'test123' },
            { email: 'admin@agridom.com', password: 'admin123' }
          ];

          const validUser = validCredentials.find(cred => 
            cred.email === email && cred.password === password
          );

          if (validUser) {
            // Token simples sem JWT por enquanto
            const simpleToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');

            return res.status(200).json({
              success: true,
              token: simpleToken,
              user: {
                id: 'temp-user-id',
                email: email,
                name: email === 'agenciakaizendesign@gmail.com' ? 'Admin Kaizen' : 'Usuário Teste'
              }
            });
          }

          return res.status(401).json({
            success: false,
            message: 'Credenciais inválidas'
          });
        } catch (error) {
          console.error('Erro no login:', error);
          return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
          });
        }
      }
      return res.status(405).json({ error: 'Método não permitido' });
    }

    // Outras rotas da API
    if (req.url === '/auth/verify' || req.url === '/api/auth/verify') {
      return res.status(200).json({ success: true, message: 'Token válido' });
    }

    if (req.url === '/auth/change-password' || req.url === '/api/auth/change-password') {
      return res.status(200).json({ success: true, message: 'Senha alterada' });
    }

    if (req.url === '/users' || req.url === '/api/users') {
      return res.status(200).json({ success: true, users: [] });
    }

    if (req.url === '/auth/register' || req.url === '/api/auth/register') {
      return res.status(200).json({ success: true, message: 'Usuário registrado' });
    }

    if (req.url.startsWith('/dashboard/stats') || req.url.startsWith('/api/dashboard/stats')) {
      return res.status(200).json({ success: true, stats: {} });
    }
    
    return res.status(404).json({ 
      error: 'Rota não encontrada',
      url: req.url,
      method: req.method
    });
    
  } catch (globalError) {
    console.error('🚨 [API] Erro global:', globalError);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: globalError.message,
      stack: process.env.NODE_ENV === 'development' ? globalError.stack : undefined
    });
  }
};