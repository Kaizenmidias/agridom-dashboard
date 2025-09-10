const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Inicializar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware para verificar token JWT do Supabase
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  try {
    // Verificar token usando o Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('🔍 DEBUG - Erro ao verificar token:', error?.message || 'Usuário não encontrado');
      return res.status(403).json({ error: 'Token inválido' });
    }
    
    // Adicionar informações do usuário à requisição
    req.user = user;
    req.userId = user.id;
    
    console.log('✅ Token válido para usuário:', user.email);
    next();
  } catch (error) {
    console.error('🔍 DEBUG - Erro ao verificar token:', error.message);
    return res.status(403).json({ error: 'Token inválido' });
  }
}

module.exports = {
  authenticateToken
};