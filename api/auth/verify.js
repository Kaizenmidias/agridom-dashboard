const jwt = require('jsonwebtoken');
const { query } = require('../db');

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar dados atualizados do usuário
    const result = await query(
      `SELECT id, email, full_name, position, avatar_url, is_active,
              can_access_dashboard, can_access_projects, can_access_briefings, 
              can_access_codes, can_access_expenses, can_access_crm, can_access_users 
       FROM users WHERE id = ? AND is_active = true`,
      [decoded.userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    const user = result.rows[0];

    const authUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      position: user.position,
      avatar_url: user.avatar_url,
      permissions: {
        can_access_dashboard: Boolean(user.can_access_dashboard),
        can_access_projects: Boolean(user.can_access_projects),
        can_access_briefings: Boolean(user.can_access_briefings),
        can_access_codes: Boolean(user.can_access_codes),
        can_access_expenses: Boolean(user.can_access_expenses),
        can_access_crm: Boolean(user.can_access_crm),
        can_access_users: Boolean(user.can_access_users)
      }
    };

    res.status(200).json({
      valid: true,
      user: authUser
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
    
    console.error('Erro na verificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}