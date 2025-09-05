const jwt = require('jsonwebtoken');

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
  
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    
    req.user = user;
    next();
  });
}

module.exports = {
  authenticateToken
};