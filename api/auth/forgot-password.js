const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

// Configuração do banco de dados para serverless
let pool;

function getPool() {
  if (!pool) {
    // Configurar string de conexão com prioridade para dashboard_POSTGRES_URL
    let connectionString;
    if (process.env.dashboard_POSTGRES_URL) {
      connectionString = process.env.dashboard_POSTGRES_URL;
    } else if (process.env.SUPABASE_DATABASE_URL) {
      connectionString = process.env.SUPABASE_DATABASE_URL;
    } else {
      // Fallback para variáveis individuais do Supabase
      const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || 5432;
  const database = process.env.POSTGRES_DATABASE || 'postgres';
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || '';
      connectionString = `postgres://${user}:${password}@${host}:${port}/${database}`;
    }

    // Desabilitar SSL completamente para resolver certificados autoassinados
    if (!connectionString.includes('sslmode')) {
      const separator = connectionString.includes('?') ? '&' : '?';
      connectionString += `${separator}sslmode=disable`;
    }

    pool = new Pool({
      connectionString,
      ssl: false,
      max: 1,
      min: 0,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
      acquireTimeoutMillis: 5000,
    });
  }
  return pool;
}

// Função para executar queries
async function query(text, params) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Configuração do transporter de email
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
      pass: process.env.SMTP_PASS || 'ethereal.pass'
    }
  });
};

// Função para enviar email de recuperação de senha
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@agridom.com',
      to: email,
      subject: 'Redefinição de Senha - AgriDom',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Redefinição de Senha</h2>
          <p>Você solicitou a redefinição de sua senha no sistema AgriDom.</p>
          <p>Clique no link abaixo para redefinir sua senha:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Redefinir Senha</a>
          <p>Este link é válido por 1 hora.</p>
          <p>Se você não solicitou esta redefinição, ignore este email.</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">AgriDom - Sistema de Gestão Agrícola</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email de recuperação enviado:', info.messageId);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Verificar se o usuário existe
    const userResult = await query(
      'SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Sempre retornar sucesso por segurança (não revelar se email existe)
    if (!userResult.rows || userResult.rows.length === 0) {
      return res.json({ message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' });
    }

    const user = userResult.rows[0];

    // Gerar token de recuperação
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

    // Salvar token no banco de dados
    await query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [resetToken, resetTokenExpiry, user.id]
    );

    // Enviar email
    const emailResult = await sendPasswordResetEmail(email, resetToken);
    
    if (!emailResult.success) {
      console.error('Falha ao enviar email:', emailResult.error);
      return res.status(500).json({ error: 'Erro ao enviar email de recuperação' });
    }

    res.json({ message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' });
  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}