import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
  
  if (url.includes('/api/testdb')) {
    try {
      // Buscar todos os usuários ativos
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, name, role, is_active')
        .eq('is_active', true);

      if (error) {
        return res.status(500).json({ 
          error: 'Erro ao consultar banco de dados',
          details: error.message 
        });
      }

      return res.json({ 
        message: 'Conexão com banco OK',
        users: users || [],
        count: users ? users.length : 0
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Erro interno',
        details: error.message 
      });
    }
  }
  
  if (url.includes('/api/auth/login') || url.includes('/auth/login') || url.includes('/api/login')) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      // Buscar usuário no Supabase
      const { data: user, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (queryError || !user) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      // Verificar senha
      const hashedPassword = crypto.createHash('sha256').update(password + 'agridom_salt').digest('hex');
      if (hashedPassword !== user.password) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      // Gerar token JWT
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '7d' }
      );

      // Retornar dados do usuário
      const authUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        permissions: {
          can_access_dashboard: user.can_access_dashboard,
          can_access_projects: user.can_access_projects,
          can_access_briefings: user.can_access_briefings,
          can_access_codes: user.can_access_codes,
          can_access_expenses: user.can_access_expenses,
          can_access_crm: user.can_access_crm,
          can_access_users: user.can_access_users
        }
      };

      return res.json({ 
        message: 'Login realizado com sucesso',
        user: authUser, 
        token 
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message
      });
    }
  }
  
  return res.status(404).json({ error: 'Rota não encontrada', url: req.url });
}