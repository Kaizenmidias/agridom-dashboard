const jwt = require('jsonwebtoken');
const { query, formatDateForMySQL } = require('./db');

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
          // GET /api/expenses/[id]
          const result = await query(
            'SELECT * FROM expenses WHERE id = ?',
            [id]
          );
          
          if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({ error: 'Despesa não encontrada' });
          }
          
          res.json(result.rows[0]);
        } else {
          // GET /api/expenses
          const result = await query(
            'SELECT * FROM expenses ORDER BY expense_date DESC'
          );
          res.json(result.rows || []);
        }
        break;

      case 'POST':
        // POST /api/expenses
        const { description, amount, expense_date, category, project_id, parcel_id } = req.body;
        
        if (!description || !amount || !expense_date) {
          return res.status(400).json({ error: 'Descrição, valor e data são obrigatórios' });
        }

        const formattedDate = formatDateForMySQL(expense_date);
        
        const insertResult = await query(
          `INSERT INTO expenses (description, amount, expense_date, category, project_id, parcel_id, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [description, amount, formattedDate, category, project_id, parcel_id, userId]
        );

        res.status(201).json({ 
          message: 'Despesa criada com sucesso', 
          id: insertResult.insertId 
        });
        break;

      case 'PUT':
        // PUT /api/expenses/[id]
        if (!id) {
          return res.status(400).json({ error: 'ID da despesa é obrigatório' });
        }

        const updateData = req.body;
        const updateFields = [];
        const updateValues = [];

        // Campos permitidos para atualização
        const allowedFields = [
          'description', 'amount', 'expense_date', 'category', 'project_id', 'parcel_id'
        ];

        allowedFields.forEach(field => {
          if (updateData[field] !== undefined) {
            updateFields.push(`${field} = ?`);
            // Formatar data se for o campo expense_date
            if (field === 'expense_date') {
              updateValues.push(formatDateForMySQL(updateData[field]));
            } else {
              updateValues.push(updateData[field]);
            }
          }
        });

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
        }

        updateValues.push(id);
        
        await query(
          `UPDATE expenses SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          updateValues
        );

        res.json({ message: 'Despesa atualizada com sucesso' });
        break;

      case 'DELETE':
        // DELETE /api/expenses/[id]
        if (!id) {
          return res.status(400).json({ error: 'ID da despesa é obrigatório' });
        }

        await query('DELETE FROM expenses WHERE id = $1', [id]);
        res.json({ message: 'Despesa removida com sucesso' });
        break;

      default:
        res.status(405).json({ error: 'Método não permitido' });
    }

  } catch (error) {
    console.error('Erro na API de despesas:', error);
    
    if (error.message === 'Token não fornecido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}