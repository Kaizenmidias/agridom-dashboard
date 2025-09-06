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
  const [hasRedirected, setHasRedirected] = React.useState(false);

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

  if (!hasPermission && !hasRedirected) {
    // Evitar loops infinitos de redirecionamento
    setHasRedirected(true);
    
    // Redirecionar para uma página que o usuário tem acesso
    // Primeiro, tentar briefings, depois códigos, depois login
    if (user.can_access_briefings && window.location.pathname !== '/briefings') {
      return <Navigate to="/briefings" replace />;
    } else if (user.can_access_codes && window.location.pathname !== '/codigos') {
      return <Navigate to="/codigos" replace />;
    } else if (window.location.pathname !== '/login') {
      // Se não tem acesso a nada, fazer logout
      localStorage.removeItem('user_data');
      localStorage.removeItem('auth_token');
      return <Navigate to="/login" replace />;
    }
  }

  // Se não tem permissão mas já redirecionou, mostrar mensagem de erro
  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h1>
          <p className="text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
          <button 
            onClick={() => window.location.href = '/briefings'}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PermissionProtectedRoute;