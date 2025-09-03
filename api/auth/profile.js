const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Middleware de autenticação
function authenticateToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Token não fornecido');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (error) {
    throw new Error('Token inválido');
  }
}

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const userId = authenticateToken(req);

    if (req.method === 'GET') {
      // GET /api/auth/profile - Buscar perfil do usuário
      const result = await query(
        'SELECT id, email, full_name, avatar_url, is_active, created_at FROM users WHERE id = ?',
        [userId]
      );

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const user = result.rows[0];
      res.json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          is_active: user.is_active,
          created_at: user.created_at
        }
      });

    } else if (req.method === 'PUT') {
      // PUT /api/auth/profile - Atualizar perfil do usuário
      const { full_name, email } = req.body;

      if (!full_name && !email) {
        return res.status(400).json({ error: 'Pelo menos um campo deve ser fornecido para atualização' });
      }

      const updateFields = [];
      const updateValues = [];

      if (full_name) {
        updateFields.push('full_name = ?');
        updateValues.push(full_name);
      }

      if (email) {
        // Verificar se o email já existe para outro usuário
        const existingUser = await query(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, userId]
        );

        if (existingUser.rows && existingUser.rows.length > 0) {
          return res.status(400).json({ error: 'Este email já está sendo usado por outro usuário' });
        }

        updateFields.push('email = ?');
        updateValues.push(email);
      }

      updateValues.push(userId);

      await query(
        `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        updateValues
      );

      // Buscar usuário atualizado
      const result = await query(
        'SELECT id, email, full_name, avatar_url, is_active FROM users WHERE id = ?',
        [userId]
      );

      const user = result.rows[0];
      res.json({
        message: 'Perfil atualizado com sucesso',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          is_active: user.is_active
        }
      });

    } else {
      res.status(405).json({ error: 'Método não permitido' });
    }

  } catch (error) {
    console.error('Erro na API de perfil:', error);
    
    if (error.message === 'Token não fornecido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}