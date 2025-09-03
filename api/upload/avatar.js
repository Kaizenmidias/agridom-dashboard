const jwt = require('jsonwebtoken');
const { query } = require('../db');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

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

// Configuração para desabilitar o parser padrão do Next.js
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const userId = authenticateToken(req);

    // Configurar formidable para processar o upload
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB
      keepExtensions: true,
      filter: function ({ name, originalFilename, mimetype }) {
        // Aceitar apenas imagens
        return mimetype && mimetype.startsWith('image/');
      }
    });

    // Processar o upload
    const [fields, files] = await form.parse(req);
    
    const avatarFile = files.avatar;
    if (!avatarFile || !avatarFile[0]) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    const file = avatarFile[0];
    
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalFilename || '.jpg');
    const filename = `avatar-${uniqueSuffix}${extension}`;
    
    // Para Vercel, vamos usar um serviço de armazenamento externo ou base64
    // Por enquanto, vamos converter para base64 e armazenar no banco
    const fileBuffer = fs.readFileSync(file.filepath);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';
    const avatarUrl = `data:${mimeType};base64,${base64Data}`;
    
    // Atualizar o avatar no MySQL
    await query(
      'UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?',
      [avatarUrl, userId]
    );
    
    // Buscar o usuário atualizado
    const userResult = await query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const updatedUser = userResult.rows[0];
    
    // Limpar arquivo temporário
    fs.unlinkSync(file.filepath);
    
    res.json({
      message: 'Avatar atualizado com sucesso',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        avatar_url: updatedUser.avatar_url,
        is_active: updatedUser.is_active
      },
      avatar_url: avatarUrl
    });

  } catch (error) {
    console.error('Erro no upload do avatar:', error);
    
    if (error.message === 'Token não fornecido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}