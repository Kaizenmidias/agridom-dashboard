// API para produção com Supabase
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

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
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasJwtSecret: !!jwtSecret
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

    // Rota de login com Supabase
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

          if (!supabase) {
            // Fallback para credenciais de desenvolvimento
            const validCredentials = [
              { email: 'agenciakaizendesign@gmail.com', password: '123456' },
              { email: 'test@test.com', password: 'test123' },
              { email: 'admin@agridom.com', password: 'admin123' }
            ];

            const validUser = validCredentials.find(cred => 
              cred.email === email && cred.password === password
            );

            if (validUser) {
              const token = jwt.sign(
                { 
                  userId: 'fallback-user-id',
                  email: email,
                  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
                },
                jwtSecret
              );

              return res.status(200).json({
                success: true,
                token: token,
                user: {
                  id: 'fallback-user-id',
                  email: email,
                  name: email === 'agenciakaizendesign@gmail.com' ? 'Admin Kaizen' : 'Usuário Teste'
                }
              });
            }

            return res.status(401).json({
              success: false,
              message: 'Credenciais inválidas'
            });
          }

          // Buscar usuário no Supabase
          const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .limit(1);

          if (userError) {
            console.error('Erro ao buscar usuário:', userError);
            return res.status(500).json({
              success: false,
              message: 'Erro interno do servidor'
            });
          }

          const user = users && users.length > 0 ? users[0] : null;

          if (!user) {
            return res.status(401).json({
              success: false,
              message: 'Credenciais inválidas'
            });
          }

          // Verificar senha
          const isValidPassword = await bcrypt.compare(password, user.password);
          
          if (!isValidPassword) {
            return res.status(401).json({
              success: false,
              message: 'Credenciais inválidas'
            });
          }

          // Gerar token JWT
          const token = jwt.sign(
            { 
              userId: user.id,
              email: user.email,
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
            },
            jwtSecret
          );

          return res.status(200).json({
            success: true,
            token: token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name || user.email
            }
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

    // Middleware de autenticação
    const authenticateToken = (req) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        throw new Error('Token não fornecido');
      }
      
      try {
        const decoded = jwt.verify(token, jwtSecret);
        return decoded;
      } catch (error) {
        throw new Error('Token inválido');
      }
    };

    // Rota de verificação de token
    if (req.url === '/auth/verify' || req.url === '/api/auth/verify') {
      try {
        const decoded = authenticateToken(req);
        return res.status(200).json({ 
          success: true, 
          valid: true,
          user: {
            id: decoded.userId,
            email: decoded.email
          }
        });
      } catch (error) {
        return res.status(401).json({ 
          success: false, 
          valid: false,
          error: error.message 
        });
      }
    }

    // Rota de usuários
    if (req.url === '/users' || req.url === '/api/users') {
      try {
        authenticateToken(req);
        
        if (!supabase) {
          return res.status(200).json({ 
            success: true, 
            data: [
              {
                id: 'fallback-user-id',
                email: 'agenciakaizendesign@gmail.com',
                name: 'Admin Kaizen',
                created_at: new Date().toISOString()
              }
            ]
          });
        }
        
        const { data: users, error } = await supabase
          .from('users')
          .select('id, email, name, created_at')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Erro ao buscar usuários:', error);
          return res.status(500).json({
            success: false,
            error: 'Erro ao buscar usuários'
          });
        }
        
        return res.status(200).json({ 
          success: true, 
          data: users || []
        });
      } catch (error) {
        return res.status(401).json({ 
          success: false, 
          error: error.message 
        });
      }
    }

    // Rota de projetos
    if (req.url === '/projects' || req.url === '/api/projects') {
      try {
        const decoded = authenticateToken(req);
        
        if (!supabase) {
          return res.status(200).json({ 
            success: true, 
            data: []
          });
        }
        
        console.log('🔍 [API] Buscando projetos para user_id:', decoded.userId);
        
        const { data: projects, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', decoded.userId)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Erro ao buscar projetos:', error);
          return res.status(500).json({
            success: false,
            error: 'Erro ao buscar projetos'
          });
        }
        
        console.log('📊 [API] Projetos encontrados:', projects?.length || 0);
        
        return res.status(200).json({ 
          success: true, 
          data: projects || []
        });
      } catch (error) {
        return res.status(401).json({ 
          success: false, 
          error: error.message 
        });
      }
    }

    // Rota de despesas
    if (req.url === '/expenses' || req.url === '/api/expenses') {
      try {
        const decoded = authenticateToken(req);
        
        if (!supabase) {
          return res.status(200).json({ 
            success: true, 
            data: []
          });
        }
        
        console.log('🔍 [API] Buscando despesas para user_id:', decoded.userId);
        
        const { data: expenses, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', decoded.userId)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Erro ao buscar despesas:', error);
          return res.status(500).json({
            success: false,
            error: 'Erro ao buscar despesas'
          });
        }
        
        console.log('📊 [API] Despesas encontradas:', expenses?.length || 0);
        
        return res.status(200).json({ 
          success: true, 
          data: expenses || []
        });
      } catch (error) {
        return res.status(401).json({ 
          success: false, 
          error: error.message 
        });
      }
    }

    // Rota de códigos
    if (req.url === '/codes' || req.url === '/api/codes') {
      try {
        const decoded = authenticateToken(req);
        
        if (!supabase) {
          return res.status(200).json({ 
            success: true, 
            data: []
          });
        }
        
        console.log('🔍 [API] Buscando códigos para user_id:', decoded.userId);
        
        const { data: codes, error } = await supabase
          .from('codes')
          .select('*')
          .eq('user_id', decoded.userId)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Erro ao buscar códigos:', error);
          return res.status(500).json({
            success: false,
            error: 'Erro ao buscar códigos'
          });
        }
        
        console.log('📊 [API] Códigos encontrados:', codes?.length || 0);
        
        return res.status(200).json({ 
          success: true, 
          data: codes || []
        });
      } catch (error) {
        return res.status(401).json({ 
          success: false, 
          error: error.message 
        });
      }
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