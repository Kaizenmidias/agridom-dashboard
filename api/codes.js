const jwt = require('jsonwebtoken');
const { query } = require('./db');

// Middleware de autenticação
function authenticateToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Token não fornecido');
  }

  try {
    const decoded = jwt.verify(token, process.env.dashboard_SUPABASE_JWT_SECRET);
    return decoded.userId;
  } catch (error) {
    throw new Error('Token inválido');
  }
}

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

  try {
    const userId = authenticateToken(req);
    const { id } = req.query;

    switch (req.method) {
      case 'GET':
        if (id) {
          // GET /api/codes/[id]
          const result = await query(
            'SELECT * FROM codes WHERE id = ?',
            [id]
          );
          
          if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({ error: 'Código não encontrado' });
          }
          
          res.json(result.rows[0]);
        } else {
          // GET /api/codes
          const result = await query(
            'SELECT * FROM codes ORDER BY created_at DESC'
          );
          res.json(result.rows || []);
        }
        break;

      case 'POST':
        // POST /api/codes
        const { code, description, category, status } = req.body;
        
        if (!code || !description) {
          return res.status(400).json({ error: 'Código e descrição são obrigatórios' });
        }

        // Verificar se o código já existe
        const existingCode = await query(
          'SELECT id FROM codes WHERE code = ?',
          [code]
        );

        if (existingCode.rows && existingCode.rows.length > 0) {
          return res.status(400).json({ error: 'Código já existe' });
        }

        const insertResult = await query(
          `INSERT INTO codes (code, description, category, status, created_by) 
           VALUES (?, ?, ?, ?, ?)`,
          [code, description, category, status || 'ativo', userId]
        );

        res.status(201).json({ 
          message: 'Código criado com sucesso', 
          id: insertResult.insertId 
        });
        break;

      case 'PUT':
        // PUT /api/codes/[id]
        if (!id) {
          return res.status(400).json({ error: 'ID do código é obrigatório' });
        }

        const updateData = req.body;
        const updateFields = [];
        const updateValues = [];

        // Campos permitidos para atualização
        const allowedFields = [
          'code', 'description', 'category', 'status'
        ];

        allowedFields.forEach(field => {
          if (updateData[field] !== undefined) {
            updateFields.push(`${field} = ?`);
            updateValues.push(updateData[field]);
          }
        });

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
        }

        // Se estiver atualizando o código, verificar se já existe
        if (updateData.code) {
          const existingCode = await query(
            'SELECT id FROM codes WHERE code = ? AND id != ?',
            [updateData.code, id]
          );

          if (existingCode.rows && existingCode.rows.length > 0) {
            return res.status(400).json({ error: 'Código já existe' });
          }
        }

        updateValues.push(id);
        
        await query(
          `UPDATE codes SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          updateValues
        );

        res.json({ message: 'Código atualizado com sucesso' });
        break;

      case 'DELETE':
        // DELETE /api/codes/[id]
        if (!id) {
          return res.status(400).json({ error: 'ID do código é obrigatório' });
        }

        await query('DELETE FROM codes WHERE id = $1', [id]);
        res.json({ message: 'Código removido com sucesso' });
        break;

      default:
        res.status(405).json({ error: 'Método não permitido' });
    }

  } catch (error) {
    console.error('Erro na API de códigos:', error);
    
    if (error.message === 'Token não fornecido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}