const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Configurar o diretório de uploads
const uploadsDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do multer para upload de avatares
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + extension);
  }
});

// Filtro para aceitar apenas imagens
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos de imagem são permitidos'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Middleware para acessar a função query
const getQuery = (req) => req.app.locals.query;

// POST /api/upload/avatar - Upload de avatar do usuário
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    const query = getQuery(req);
    const userId = req.user.userId;
    
    // Construir URL do avatar
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    // Atualizar o avatar do usuário no banco de dados
    await query(
      'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [avatarUrl, userId]
    );
    
    // Buscar o usuário atualizado
    const result = await query(
      'SELECT id, email, full_name, avatar_url, is_active FROM users WHERE id = ?',
      [userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const updatedUser = result.rows[0];
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
    
    // Remover o arquivo se houve erro
    if (req.file) {
      fs.unlink(req.file.path, (unlinkError) => {
        if (unlinkError) console.error('Erro ao remover arquivo:', unlinkError);
      });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;