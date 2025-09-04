import bcrypt from 'bcryptjs';
import { query } from '../utils/db.js';

// Configuração CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

export default async function handler(req, res) {
  try {
    console.log('Reset password handler iniciado:', {
      method: req.method,
      url: req.url
    });

    // Configurar CORS
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    // Buscar usuário pelo token
    const userResult = await query(
      'SELECT id, reset_password_expires FROM users WHERE reset_password_token = $1 AND status = $2',
      [token, 'active']
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const user = userResult.rows[0];

    // Verificar se o token não expirou
    const now = new Date();
    const expiresAt = new Date(user.reset_password_expires);
    
    if (expiresAt < now) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Atualizar senha e limpar token
    await query(
      'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user.id]
    );

    console.log('Senha redefinida com sucesso para usuário ID:', user.id);

    res.json({ message: 'Senha redefinida com sucesso' });

  } catch (error) {
    console.error('Erro ao redefinir senha:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}