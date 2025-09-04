const express = require('express');
const jwt = require('jsonwebtoken');
const { getQuery } = require('../config/database');

const router = express.Router();

// Middleware para verificar se o usuário é administrador
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const query = getQuery(req);
    
    const result = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];
    const isAdmin = user.role && (
      user.role.toLowerCase() === 'administrador' ||
      user.role.toLowerCase() === 'admin' ||
      user.role.toLowerCase() === 'administrator'
    );

    if (!isAdmin) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem gerenciar permissões.' });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Erro na verificação de admin:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};

// GET /api/permissions/users - Listar usuários não-administradores
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const query = getQuery(req);
    
    const result = await query(`
      SELECT 
        u.id,
        u.email,
        u.name as full_name,
        u.role,
        u.is_active,
        get_user_permissions(u.id) as permissions
      FROM users u
      WHERE u.role IS NOT NULL 
        AND LOWER(u.role) NOT IN ('administrador', 'admin', 'administrator')
        AND u.is_active = true
      ORDER BY u.name, u.email
    `);

    const users = result.rows.map(user => ({
      ...user,
      permissions: user.permissions || {},
      is_admin: false
    }));

    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/permissions/user/:userId - Obter permissões de um usuário específico
router.get('/user/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const query = getQuery(req);
    
    // Verificar se o usuário existe e não é admin
    const userResult = await query(
      'SELECT id, email, name as full_name, role FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];
    const isAdmin = user.role && (
      user.role.toLowerCase() === 'administrador' ||
      user.role.toLowerCase() === 'admin' ||
      user.role.toLowerCase() === 'administrator'
    );

    if (isAdmin) {
      return res.status(400).json({ error: 'Não é possível gerenciar permissões de administradores' });
    }

    // Buscar permissões atuais
    const permissionsResult = await query(
      'SELECT get_user_permissions($1) as permissions',
      [userId]
    );

    const permissions = permissionsResult.rows[0]?.permissions || {};

    // Buscar permissões personalizadas
    const customPermissionsResult = await query(`
      SELECT 
        permission_name,
        permission_value,
        granted_by,
        granted_at,
        notes,
        admin.name as granted_by_name
      FROM user_custom_permissions ucp
      LEFT JOIN users admin ON admin.id = ucp.granted_by
      WHERE ucp.user_id = $1
      ORDER BY ucp.granted_at DESC
    `, [userId]);

    res.json({
      user,
      permissions,
      custom_permissions: customPermissionsResult.rows
    });
  } catch (error) {
    console.error('Erro ao buscar permissões do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/permissions/user/:userId - Atualizar permissões de um usuário
router.put('/user/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions, notes } = req.body;
    const query = getQuery(req);
    
    // Verificar se o usuário existe e não é admin
    const userResult = await query(
      'SELECT id, email, name as full_name, role FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];
    const isAdmin = user.role && (
      user.role.toLowerCase() === 'administrador' ||
      user.role.toLowerCase() === 'admin' ||
      user.role.toLowerCase() === 'administrator'
    );

    if (isAdmin) {
      return res.status(400).json({ error: 'Não é possível gerenciar permissões de administradores' });
    }

    // Validar permissões
    const validPermissions = [
      'can_access_dashboard',
      'can_access_projects',
      'can_access_briefings',
      'can_access_users',
      'can_access_reports',
      'can_access_settings',
      'can_manage_users',
      'can_manage_projects',
      'can_manage_briefings',
      'can_manage_reports',
      'can_manage_settings'
    ];

    // Iniciar transação
    await query('BEGIN');

    try {
      // Remover permissões personalizadas existentes
      await query(
        'DELETE FROM user_custom_permissions WHERE user_id = $1',
        [userId]
      );

      // Inserir novas permissões personalizadas
      for (const [permissionName, permissionValue] of Object.entries(permissions)) {
        if (validPermissions.includes(permissionName)) {
          await query(`
            INSERT INTO user_custom_permissions 
            (user_id, permission_name, permission_value, granted_by, notes)
            VALUES ($1, $2, $3, $4, $5)
          `, [userId, permissionName, permissionValue, req.adminUser.id, notes || null]);
        }
      }

      // Atualizar permissões na tabela users usando a função
      const newPermissions = await query(
        'SELECT get_user_permissions($1) as permissions',
        [userId]
      );

      const perms = newPermissions.rows[0]?.permissions || {};

      await query(`
        UPDATE users SET 
          can_access_dashboard = $2,
          can_access_projects = $3,
          can_access_briefings = $4,
          can_access_users = $5,
          can_access_reports = $6,
          can_access_settings = $7
        WHERE id = $1
      `, [
        userId,
        perms.can_access_dashboard || false,
        perms.can_access_projects || false,
        perms.can_access_briefings || false,
        perms.can_access_users || false,
        perms.can_access_reports || false,
        perms.can_access_settings || false
      ]);

      await query('COMMIT');

      res.json({ 
        message: 'Permissões atualizadas com sucesso',
        user: user,
        permissions: perms
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/permissions/roles - Listar definições de cargos
router.get('/roles', requireAdmin, async (req, res) => {
  try {
    const query = getQuery(req);
    
    const result = await query(`
      SELECT 
        role_name,
        display_name,
        description,
        is_admin,
        default_permissions,
        created_at,
        updated_at
      FROM role_definitions
      ORDER BY is_admin DESC, display_name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar definições de cargos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/permissions/roles - Criar nova definição de cargo
router.post('/roles', requireAdmin, async (req, res) => {
  try {
    const { role_name, display_name, description, is_admin, default_permissions } = req.body;
    const query = getQuery(req);
    
    // Validar dados obrigatórios
    if (!role_name || !display_name) {
      return res.status(400).json({ error: 'Nome do cargo e nome de exibição são obrigatórios' });
    }

    const result = await query(`
      INSERT INTO role_definitions 
      (role_name, display_name, description, is_admin, default_permissions)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [role_name, display_name, description || null, is_admin || false, default_permissions || {}]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar definição de cargo:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Já existe um cargo com este nome' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// DELETE /api/permissions/user/:userId/custom/:permissionName - Remover permissão personalizada específica
router.delete('/user/:userId/custom/:permissionName', requireAdmin, async (req, res) => {
  try {
    const { userId, permissionName } = req.params;
    const query = getQuery(req);
    
    await query(
      'DELETE FROM user_custom_permissions WHERE user_id = $1 AND permission_name = $2',
      [userId, permissionName]
    );

    // Recalcular e atualizar permissões do usuário
    const newPermissions = await query(
      'SELECT get_user_permissions($1) as permissions',
      [userId]
    );

    const perms = newPermissions.rows[0]?.permissions || {};

    await query(`
      UPDATE users SET 
        can_access_dashboard = $2,
        can_access_projects = $3,
        can_access_briefings = $4,
        can_access_users = $5,
        can_access_reports = $6,
        can_access_settings = $7
      WHERE id = $1
    `, [
      userId,
      perms.can_access_dashboard || false,
      perms.can_access_projects || false,
      perms.can_access_briefings || false,
      perms.can_access_users || false,
      perms.can_access_reports || false,
      perms.can_access_settings || false
    ]);

    res.json({ message: 'Permissão personalizada removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover permissão personalizada:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;