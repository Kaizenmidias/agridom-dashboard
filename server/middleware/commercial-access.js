function isAdministrator(role) {
  return ['admin', 'administrator', 'administrador'].includes(String(role || '').toLowerCase());
}

function requireCommercialAccess(req, res, next) {
  const query = req.app.locals.query;

  Promise.resolve(query('SELECT role, is_active, can_access_crm FROM users WHERE id = ? LIMIT 1', [req.userId]))
    .then((result) => {
      const user = result.rows?.[0];
      if (!user?.is_active || (!isAdministrator(user.role) && !user.can_access_crm)) {
        return res.status(403).json({ error: 'Sem permissao para acessar entidades comerciais.' });
      }
      req.commercialUser = user;
      next();
    })
    .catch(() => res.status(500).json({ error: 'Nao foi possivel validar a permissao.' }));
}

function requireCommercialAdmin(req, res, next) {
  if (!isAdministrator(req.commercialUser?.role)) {
    return res.status(403).json({ error: 'Apenas administradores podem alterar a estrutura da Pipeline.' });
  }
  next();
}

module.exports = { isAdministrator, requireCommercialAccess, requireCommercialAdmin };
