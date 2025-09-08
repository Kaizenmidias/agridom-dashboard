import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, getAuthToken } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();

  // Removido useEffect que verificava token - isso estava causando loops
  // A verificação de token já é feita no AuthContext de forma controlada

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

  // Verificar se está autenticado e tem token válido
  if (!isAuthenticated || !user || !getAuthToken()) {
    console.warn('Tentativa de acesso a rota protegida sem autenticação válida');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;