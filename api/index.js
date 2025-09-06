const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware de autenticação
const authenticateToken = (token) => {
  if (!token) {
    throw new Error('Token não fornecido');
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    return decoded.sub || decoded.userId || 4; // Fallback para usuário 4
  } catch (error) {
    throw new Error('Token inválido');
  }
};

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
    console.log('🔍 [API] Body:', req.body);
    console.log('🔍 [API] Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasJwtSecret: !!jwtSecret
    });

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

  // Rota de teste para variáveis de ambiente
  if (req.url === '/api/test-env') {
    if (req.method === 'GET') {
      try {
        const envCheck = {
          NODE_ENV: process.env.NODE_ENV,
          SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
          SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET',
          JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT_SET',
          timestamp: new Date().toISOString()
        };
        return res.status(200).json(envCheck);
      } catch (error) {
        return res.status(500).json({ error: error.message, stack: error.stack });
      }
    }
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Rota de login
  if (req.url === '/api/login' || req.url === '/api/auth/login') {
    if (req.method === 'POST') {
      try {
        const { email, password } = req.body || {};
        
        if (!email || !password) {
          return res.status(400).json({
            success: false,
            message: 'Email e senha são obrigatórios'
          });
        }

        // Credenciais de fallback para teste
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
              userId: 'temp-user-id', 
              email: email 
            },
            jwtSecret,
            { expiresIn: '24h' }
          );

          return res.status(200).json({
            success: true,
            token,
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
        console.error('Erro interno:', error);
        return res.status(500).json({
          success: false,
          message: 'Erro interno do servidor'
        });
      }
    }
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Extrair token de autenticação
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  try {
    // Rotas que precisam de autenticação
    if (req.url.startsWith('/api/projects') || req.url.startsWith('/api/expenses') || req.url.startsWith('/api/codes')) {
      const userId = authenticateToken(token);
      
      // PROJETOS
      if (req.url === '/api/projects') {
        if (req.method === 'GET') {
          const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          return res.status(200).json(data || []);
        }
        
        if (req.method === 'POST') {
          const { name, project_type = 'website', status = 'active' } = req.body;
          
          if (!name) {
            return res.status(400).json({ error: 'Nome do projeto é obrigatório' });
          }
          
          const { data, error } = await supabase
            .from('projects')
            .insert([{ name, project_type, status, user_id: userId }])
            .select()
            .single();
          
          if (error) throw error;
          return res.status(201).json(data);
        }
      }
      
      // DESPESAS
      if (req.url === '/api/expenses') {
        if (req.method === 'GET') {
          const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          return res.status(200).json(data || []);
        }
        
        if (req.method === 'POST') {
          const { name, amount, billing_type = 'mensal', project_id } = req.body;
          
          if (!name || !amount) {
            return res.status(400).json({ error: 'Nome e valor são obrigatórios' });
          }
          
          const { data, error } = await supabase
            .from('expenses')
            .insert([{ name, amount, billing_type, project_id, user_id: userId }])
            .select()
            .single();
          
          if (error) throw error;
          return res.status(201).json(data);
        }
      }
      
      // CÓDIGOS
      if (req.url === '/api/codes') {
        if (req.method === 'GET') {
          const { data, error } = await supabase
            .from('codes')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          return res.status(200).json(data || []);
        }
        
        if (req.method === 'POST') {
          const { title, description, code_content, language = 'html', project_id } = req.body;
          
          if (!title || !code_content) {
            return res.status(400).json({ error: 'Título e código são obrigatórios' });
          }
          
          const { data, error } = await supabase
            .from('codes')
            .insert([{ title, description, code_content, language, project_id, user_id: userId }])
            .select()
            .single();
          
          if (error) throw error;
          return res.status(201).json(data);
        }
      }
    }
  } catch (authError) {
    return res.status(401).json({ error: authError.message });
  } catch (error) {
    console.error('Erro na API:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
  
  return res.status(404).json({ error: 'Rota não encontrada' });
  
  } catch (globalError) {
    console.error('🚨 [API] Erro global não tratado:', globalError);
    console.error('🚨 [API] Stack trace:', globalError.stack);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? globalError.message : 'Internal server error'
    });
  }
}