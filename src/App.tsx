
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import ProjetosPage from "./pages/ProjetosPage";
import BriefingsPage from "./pages/BriefingsPage";
import { CodesPage } from "./pages/CodesPage";
import DespesasPage from "./pages/DespesasPage";
import CRMPage from "./pages/CRMPage";
import UsuariosPage from "./pages/UsuariosPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import { useEffect } from "react";
import { CRMProvider } from "./contexts/CRMContext";
import { StatisticsProvider } from "./contexts/StatisticsContext";
import { AppSettingsProvider } from "./contexts/AppSettingsContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import { trackPageView } from "./utils/analytics";

// Define routes configuration
const routes = [
  { path: "/login", element: <LoginPage />, protected: false },
  { path: "/forgot-password", element: <ForgotPasswordPage />, protected: false },
  { path: "/reset-password", element: <ResetPasswordPage />, protected: false },
  { path: "/", element: <Index />, protected: true },
  { path: "/projetos", element: <ProjetosPage />, protected: true },
  { path: "/briefings", element: <BriefingsPage />, protected: true },
  { path: "/codigos", element: <CodesPage />, protected: true },
  { path: "/despesas", element: <DespesasPage />, protected: true },
  { path: "/crm", element: <CRMPage />, protected: true },
  { path: "/usuarios", element: <UsuariosPage />, protected: true },
  { path: "*", element: <NotFound />, protected: false }
];

// Create query client with enhanced configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

// Router change handler component
const RouterChangeHandler = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0);
    
    // Track page view for analytics
    const currentPath = location.pathname;
    const pageName = currentPath === '/' ? 'dashboard' : currentPath.replace(/^\//, '');
    trackPageView(pageName);
  }, [location.pathname]);
  
  return null;
};

// Layout component that conditionally shows sidebar
const AppLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  // Don't show sidebar on login page or when not authenticated
  const showSidebar = isAuthenticated && location.pathname !== '/login';
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  if (!showSidebar) {
    return (
      <div className="min-h-screen w-full">
        <RouterChangeHandler />
        <Routes>
          {routes.map((route) => (
            <Route 
              key={route.path} 
              path={route.path} 
              element={route.protected ? (
                <ProtectedRoute>{route.element}</ProtectedRoute>
              ) : (
                route.element
              )} 
            />
          ))}
        </Routes>
      </div>
    );
  }
  
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1">
          <header className="h-12 flex items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <div className="flex-1">
            <RouterChangeHandler />
            <Routes>
              {routes.map((route) => (
                <Route 
                  key={route.path} 
                  path={route.path} 
                  element={route.protected ? (
                    <ProtectedRoute>{route.element}</ProtectedRoute>
                  ) : (
                    route.element
                  )} 
                />
              ))}
            </Routes>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

// Application main component with sidebar layout
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppSettingsProvider>
          <CRMProvider>
            <StatisticsProvider>
              <BrowserRouter>
                <TooltipProvider>
                  <AppLayout />
                  <Toaster />
                </TooltipProvider>
              </BrowserRouter>
            </StatisticsProvider>
          </CRMProvider>
        </AppSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
