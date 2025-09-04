import { query } from '../utils/db.js';
import crypto from 'crypto';

// Configuração CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

export default async function handler(req, res) {
  try {
    console.log('Forgot password handler iniciado:', {
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

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Verificar se o usuário existe
    const userResult = await query(
      'SELECT id, email FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    // Sempre retornar sucesso por segurança (não revelar se email existe)
    if (userResult.rows.length === 0) {
      console.log('Email não encontrado:', email);
      return res.json({ message: 'Se o email existir, você receberá instruções para redefinir sua senha.' });
    }

    const user = userResult.rows[0];

    // Gerar token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hora

    // Salvar token no banco
    await query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );

    console.log('Token de reset gerado para:', email);

    // TODO: Implementar envio de email
    // Por enquanto, apenas log do token para desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('Token de reset (DEV):', resetToken);
    }

    res.json({ 
      message: 'Se o email existir, você receberá instruções para redefinir sua senha.',
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });

  } catch (error) {
    console.error('Erro ao processar forgot password:', {
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