import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, getAuthToken } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Aguardar o carregamento inicial da autenticação
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

  // Só redirecionar para login se:
  // 1. Não está autenticado E
  // 2. Não tem usuário E
  // 3. Não tem token E
  // 4. Não está já na página de login (evita loop)
  const shouldRedirectToLogin = (!isAuthenticated || !user || !getAuthToken()) && 
                                location.pathname !== '/login' && 
                                location.pathname !== '/forgot-password' && 
                                location.pathname !== '/reset-password';

  if (shouldRedirectToLogin) {
    console.warn('Redirecionando para login - usuário não autenticado');
    return <Navigate to="/login" replace />;
  }

  // Se chegou até aqui e não tem usuário, mas está numa rota de auth, permitir acesso
  if (!user && (location.pathname === '/login' || location.pathname === '/forgot-password' || location.pathname === '/reset-password')) {
    return <>{children}</>;
  }

  // Se tem usuário, permitir acesso
  if (user && isAuthenticated) {
    return <>{children}</>;
  }

  // Fallback - mostrar loading se não conseguir determinar o estado
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-600">Verificando autenticação...</p>
      </div>
    </div>
  );
};

export default ProtectedRoute;