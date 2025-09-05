import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthUser } from '@/types/database';

interface PermissionProtectedRouteProps {
  children: React.ReactNode;
  permission?: keyof AuthUser;
  fallbackPath?: string;
}

const PermissionProtectedRoute: React.FC<PermissionProtectedRouteProps> = ({ 
  children, 
  permission,
  fallbackPath = '/briefings' // Página padrão para usuários sem permissão
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se não há permissão específica definida, permitir acesso
  if (!permission) {
    return <>{children}</>;
  }

  // Verificar se o usuário tem a permissão específica
  const hasPermission = user[permission] === true;

  if (!hasPermission) {
    // Redirecionar para uma página que o usuário tem acesso
    // Primeiro, tentar briefings, depois códigos, depois login
    if (user.can_access_briefings) {
      return <Navigate to="/briefings" replace />;
    } else if (user.can_access_codes) {
      return <Navigate to="/codigos" replace />;
    } else {
      // Se não tem acesso a nada, fazer logout
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
};

export default PermissionProtectedRoute;