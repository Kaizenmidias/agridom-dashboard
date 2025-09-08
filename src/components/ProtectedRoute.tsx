import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, getAuthToken, isTokenValid } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isAuthenticated, logout } = useAuth();

  // Verificar token válido apenas uma vez quando o componente monta
  useEffect(() => {
    let isMounted = true;
    
    const checkTokenValidity = async () => {
      const token = getAuthToken();
      if (token && user && isMounted) {
        const valid = await isTokenValid(token);
        if (!valid && isMounted) {
          console.warn('Token inválido detectado em ProtectedRoute, fazendo logout');
          logout();
        }
      }
    };

    // Verificar apenas se não está carregando e tem usuário
    // Usar timeout para evitar verificações excessivas
    if (!loading && user) {
      const timeoutId = setTimeout(checkTokenValidity, 500);
      return () => {
        clearTimeout(timeoutId);
        isMounted = false;
      };
    }
    
    return () => {
      isMounted = false;
    };
  }, [user, loading]); // Removido logout das dependências

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