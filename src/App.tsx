
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useMemo, useRef } from "react";
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
import DebugEnv from "./components/DebugEnv";
// Removed PermissionProtectedRoute - no longer needed
import { useEffect } from "react";
import { CRMProvider } from "./contexts/CRMContext";
import { AppSettingsProvider } from "./contexts/AppSettingsContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import { trackPageView } from "./utils/analytics";

// Define routes configuration without permissions
const routes = [
  { path: "/login", element: <LoginPage />, protected: false },
  { path: "/forgot-password", element: <ForgotPasswordPage />, protected: false },
  { path: "/reset-password", element: <ResetPasswordPage />, protected: false },
  { path: "/", element: <Index />, protected: true },
  { path: "/dashboard", element: <Index />, protected: true },
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

// Using BrowserRouter for clean URLs without hash fragments
// Vercel configuration handles SPA routing with rewrites

// Layout component that conditionally shows sidebar
const AppLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  
  // Don't show sidebar when not authenticated
  const showSidebar = isAuthenticated;
  
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
            <Routes>
              {routes.map((route) => {
                if (!route.protected) {
                  return (
                    <Route 
                      key={route.path} 
                      path={route.path} 
                      element={route.element} 
                    />
                  );
                }
                
                // All protected routes use simple ProtectedRoute
                return (
                  <Route 
                    key={route.path} 
                    path={route.path} 
                    element={
                      <ProtectedRoute>{route.element}</ProtectedRoute>
                    } 
                  />
                );
              })}
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
            <BrowserRouter>
              <TooltipProvider>
                <AppLayout />
                <Toaster />
                <DebugEnv />
              </TooltipProvider>
            </BrowserRouter>
          </CRMProvider>
        </AppSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
