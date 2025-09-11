const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Inicializar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware para verificar token JWT (local ou Supabase)
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  try {
    // Primeiro, tentar verificar como JWT local
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      req.userId = decoded.userId;
      req.user = { id: decoded.userId, email: decoded.email };
      console.log('✅ Token JWT local válido para usuário:', decoded.email);
      return next();
    } catch (jwtError) {
      console.log('🔍 DEBUG - Token JWT local inválido, tentando Supabase Auth...');
    }
    
    // Se JWT local falhar, tentar Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('🔍 DEBUG - Erro ao verificar token com Supabase:', error?.message || 'Usuário não encontrado');
      return res.status(403).json({ error: 'Token inválido' });
    }
    
    // Adicionar informações do usuário à requisição
    req.user = user;
    req.userId = user.id;
    
    console.log('✅ Token Supabase válido para usuário:', user.email);
    next();
  } catch (error) {
    console.error('🔍 DEBUG - Erro ao verificar token:', error.message);
    return res.status(403).json({ error: 'Token inválido' });
  }
}

module.exports = {
  authenticateToken
};