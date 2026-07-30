const { createClient } = require('@supabase/supabase-js');

function getSupabaseClients() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
    throw new Error('Supabase nao configurado');
  }

  return {
    admin: createClient(supabaseUrl, serviceRoleKey || anonKey),
    auth: createClient(supabaseUrl, anonKey || serviceRoleKey),
  };
}

async function authenticateUser(req, authClient) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new Error('Token nao fornecido');

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user?.email) {
    throw new Error('Token invalido');
  }

  return data.user.email;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: 'Metodo nao permitido' }));
    }

    const { admin, auth } = getSupabaseClients();
    const email = await authenticateUser(req, auth);

    const { data: currentUser, error: currentUserError } = await admin
      .from('users')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();

    if (currentUserError) throw currentUserError;
    if (!currentUser?.id) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'Usuario nao encontrado' }));
    }

    const { data, error } = await admin
      .from('users')
      .select('id, email, name, full_name, role, avatar_url, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = (data || []).map((user) => ({
      ...user,
      full_name: user.full_name || user.name || '',
    }));

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(users));
  } catch (error) {
    res.statusCode = error.statusCode || 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: error.message || 'Erro ao carregar usuarios' }));
  }
};
