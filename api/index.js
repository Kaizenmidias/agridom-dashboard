import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

const supabase = createClient(supabaseUrl, supabaseKey);

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

  // Rota de login com fallback para credenciais específicas
  if (req.url === '/api/login') {
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

        // Tentar Supabase como fallback
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (!error && data.user) {
            const token = jwt.sign(
              { 
                userId: data.user.id, 
                email: data.user.email 
              },
              jwtSecret,
              { expiresIn: '24h' }
            );

            return res.status(200).json({
              success: true,
              token,
              user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.name || 'Usuário'
              }
            });
          }
        } catch (supabaseError) {
          console.error('Erro no Supabase:', supabaseError);
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
  
  return res.status(404).json({ error: 'Rota não encontrada' });
}