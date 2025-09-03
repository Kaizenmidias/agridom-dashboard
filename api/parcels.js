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
          // GET /api/parcels/[id]
          const result = await query(
            'SELECT * FROM parcels WHERE id = ?',
            [id]
          );
          
          if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({ error: 'Parcela não encontrada' });
          }
          
          res.json(result.rows[0]);
        } else {
          // GET /api/parcels
          const result = await query(
            'SELECT * FROM parcels ORDER BY created_at DESC'
          );
          res.json(result.rows || []);
        }
        break;

      case 'POST':
        // POST /api/parcels
        const { name, area, location, soil_type, project_id } = req.body;
        
        if (!name || !area) {
          return res.status(400).json({ error: 'Nome e área são obrigatórios' });
        }

        const insertResult = await query(
          `INSERT INTO parcels (name, area, location, soil_type, project_id, created_by) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [name, area, location, soil_type, project_id, userId]
        );

        res.status(201).json({ 
          message: 'Parcela criada com sucesso', 
          id: insertResult.insertId 
        });
        break;

      case 'PUT':
        // PUT /api/parcels/[id]
        if (!id) {
          return res.status(400).json({ error: 'ID da parcela é obrigatório' });
        }

        const updateData = req.body;
        const updateFields = [];
        const updateValues = [];

        // Campos permitidos para atualização
        const allowedFields = [
          'name', 'area', 'location', 'soil_type', 'project_id'
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

        updateValues.push(id);
        
        await query(
          `UPDATE parcels SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          updateValues
        );

        res.json({ message: 'Parcela atualizada com sucesso' });
        break;

      case 'DELETE':
        // DELETE /api/parcels/[id]
        if (!id) {
          return res.status(400).json({ error: 'ID da parcela é obrigatório' });
        }

        await query('DELETE FROM parcels WHERE id = $1', [id]);
        res.json({ message: 'Parcela removida com sucesso' });
        break;

      default:
        res.status(405).json({ error: 'Método não permitido' });
    }

  } catch (error) {
    console.error('Erro na API de parcelas:', error);
    
    if (error.message === 'Token não fornecido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}