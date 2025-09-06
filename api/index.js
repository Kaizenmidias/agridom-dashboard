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

  // Rota de login com Supabase
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

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          console.error('Erro no login:', error);
          return res.status(401).json({
            success: false,
            message: 'Credenciais inválidas'
          });
        }

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