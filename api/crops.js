const jwt = require('jsonwebtoken');
const { query } = require('./db');

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
          // GET /api/crops/[id]
          const result = await query(
            'SELECT * FROM crops WHERE id = ?',
            [id]
          );
          
          if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({ error: 'Cultivo não encontrado' });
          }
          
          res.json(result.rows[0]);
        } else {
          // GET /api/crops
          const result = await query(
            'SELECT * FROM crops ORDER BY planting_date DESC'
          );
          res.json(result.rows || []);
        }
        break;

      case 'POST':
        // POST /api/crops
        const { crop_type, variety, planting_date, expected_harvest_date, parcel_id, status } = req.body;
        
        if (!crop_type || !planting_date || !parcel_id) {
          return res.status(400).json({ error: 'Tipo de cultivo, data de plantio e parcela são obrigatórios' });
        }

        const insertResult = await query(
          `INSERT INTO crops (crop_type, variety, planting_date, expected_harvest_date, parcel_id, status, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [crop_type, variety, planting_date, expected_harvest_date, parcel_id, status || 'ativo', userId]
        );

        res.status(201).json({ 
          message: 'Cultivo criado com sucesso', 
          id: insertResult.insertId 
        });
        break;

      case 'PUT':
        // PUT /api/crops/[id]
        if (!id) {
          return res.status(400).json({ error: 'ID do cultivo é obrigatório' });
        }

        const updateData = req.body;
        const updateFields = [];
        const updateValues = [];

        // Campos permitidos para atualização
        const allowedFields = [
          'crop_type', 'variety', 'planting_date', 'expected_harvest_date', 
          'actual_harvest_date', 'parcel_id', 'status', 'notes'
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
          `UPDATE crops SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          updateValues
        );

        res.json({ message: 'Cultivo atualizado com sucesso' });
        break;

      case 'DELETE':
        // DELETE /api/crops/[id]
        if (!id) {
          return res.status(400).json({ error: 'ID do cultivo é obrigatório' });
        }

        await query('DELETE FROM crops WHERE id = ?', [id]);
        res.json({ message: 'Cultivo removido com sucesso' });
        break;

      default:
        res.status(405).json({ error: 'Método não permitido' });
    }

  } catch (error) {
    console.error('Erro na API de cultivos:', error);
    
    if (error.message === 'Token não fornecido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}