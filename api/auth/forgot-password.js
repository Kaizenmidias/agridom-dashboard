const { query } = require('../db');
const crypto = require('crypto');

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Verificar se o usuário existe no MySQL
    const userResult = await query(
      'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );

    if (userResult.rows.length === 0) {
      // Por segurança, sempre retornar sucesso mesmo se o email não existir
      return res.json({ 
        message: 'Se o email existir em nossa base de dados, você receberá instruções para redefinir sua senha.' 
      });
    }

    const user = userResult.rows[0];

    // Gerar token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

    // Salvar token no MySQL
    await query(
      'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
      [resetToken, resetTokenExpiry, user.id]
    );

    // Em um ambiente real, aqui você enviaria um email com o link de reset
    // Para este exemplo, vamos apenas retornar o token (NÃO FAZER EM PRODUÇÃO)
    console.log(`Token de reset para ${email}: ${resetToken}`);
    
    // IMPORTANTE: Em produção, remover a linha abaixo e implementar envio de email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    res.json({ 
      message: 'Se o email existir em nossa base de dados, você receberá instruções para redefinir sua senha.',
      // REMOVER EM PRODUÇÃO - apenas para desenvolvimento
      resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined
    });

  } catch (error) {
    console.error('Erro no esquecimento de senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}