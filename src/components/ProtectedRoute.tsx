import React, { useRef, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, getAuthToken } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Cache para evitar múltiplas navegações rápidas
let lastNavigationTime = 0;
const NAVIGATION_THROTTLE_MS = 100;

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const hasNavigatedRef = useRef(false);

  // Reset navigation flag when location changes
  useEffect(() => {
    hasNavigatedRef.current = false;
  }, [location.pathname]);

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

  // Rotas de autenticação que não precisam de proteção
  const authRoutes = ['/login', '/forgot-password', '/reset-password'];
  const isAuthRoute = authRoutes.includes(location.pathname);

  // Se está numa rota de auth e não tem usuário, permitir acesso
  if (isAuthRoute && !user) {
    return <>{children}</>;
  }

  // Se está numa rota de auth e tem usuário, redirecionar para dashboard
  if (isAuthRoute && user && isAuthenticated) {
    const now = Date.now();
    if (!hasNavigatedRef.current && now - lastNavigationTime > NAVIGATION_THROTTLE_MS) {
      hasNavigatedRef.current = true;
      lastNavigationTime = now;
      console.log('Usuário autenticado redirecionando de rota de auth para dashboard');
      return <Navigate to="/" replace />;
    }
    // Se já navegou recentemente, mostrar loading
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // Para rotas protegidas, verificar autenticação
  const hasValidAuth = isAuthenticated && user && getAuthToken();
  
  if (!hasValidAuth && !isAuthRoute) {
    const now = Date.now();
    if (!hasNavigatedRef.current && now - lastNavigationTime > NAVIGATION_THROTTLE_MS) {
      hasNavigatedRef.current = true;
      lastNavigationTime = now;
      console.warn('Redirecionando para login - usuário não autenticado');
      return <Navigate to="/login" replace />;
    }
    // Se já navegou recentemente, mostrar loading
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Se tem autenticação válida, permitir acesso
  if (hasValidAuth) {
    return <>{children}</>;
  }

  // Fallback - mostrar loading
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