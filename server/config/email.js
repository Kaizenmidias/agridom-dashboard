const nodemailer = require('nodemailer');

// Configuração do transporter de email
const createTransporter = () => {
  // Para desenvolvimento, usando Ethereal Email (fake SMTP)
  // Em produção, substitua pelas configurações do seu provedor de email
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true para 465, false para outras portas
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
    
    // URL do frontend para redefinição de senha
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
    
    // Para desenvolvimento com Ethereal, mostrar URL de preview
    if (process.env.NODE_ENV !== 'production') {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail
};