/**
 * Utilitário para calcular permissões de usuário
 * Substitui a função PostgreSQL get_user_permissions para compatibilidade com SQLite
 */

function getUserPermissions(userRole) {
  if (!userRole) {
    return {
      can_access_dashboard: false,
      can_access_projects: false,
      can_access_briefings: false,
      can_access_users: false,
      can_access_reports: false,
      can_access_settings: false,
      can_manage_users: false,
      can_manage_projects: false,
      can_manage_briefings: false,
      can_manage_reports: false,
      can_manage_settings: false
    };
  }
  
  const role = userRole.toLowerCase();
  
  // Verificar se é administrador
  if (role === 'admin' || role === 'administrador' || role === 'administrator') {
    return {
      can_access_dashboard: true,
      can_access_projects: true,
      can_access_briefings: true,
      can_access_codes: true,
      can_access_expenses: true,
      can_access_crm: true,
      can_access_users: true,
      can_access_reports: true,
      can_access_settings: true,
      can_manage_users: true,
      can_manage_projects: true,
      can_manage_briefings: true,
      can_manage_reports: true,
      can_manage_settings: true
    };
  }
  
  // Permissões para web designer
  if (role === 'web designer' || role === 'designer') {
    return {
      can_access_dashboard: true,
      can_access_projects: true,
      can_access_briefings: true,
      can_access_users: false,
      can_access_reports: true,
      can_access_settings: false,
      can_manage_users: false,
      can_manage_projects: true,
      can_manage_briefings: true,
      can_manage_reports: false,
      can_manage_settings: false
    };
  }
  
  // Permissões padrão para outros cargos
  return {
    can_access_dashboard: true,
    can_access_projects: false,
    can_access_briefings: false,
    can_access_users: false,
    can_access_reports: false,
    can_access_settings: false,
    can_manage_users: false,
    can_manage_projects: false,
    can_manage_briefings: false,
    can_manage_reports: false,
    can_manage_settings: false
  };
}

module.exports = {
  getUserPermissions
};