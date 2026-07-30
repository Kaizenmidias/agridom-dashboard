
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useMemo, useRef } from "react";
import Index from "./pages/Index";
import ProjetosPage from "./pages/ProjetosPage";
import BriefingsPage from "./pages/BriefingsPage";
import { CodesPage } from "./pages/CodesPage";
import AcessosPage from "./pages/AcessosPage";
import DespesasPage from "./pages/DespesasPage";
import CRMPage from "./pages/CRMPage";
import ProspectingPage from "./pages/commercial/ProspectingPage";
import UsuariosPage from "./pages/UsuariosPage";
import LeadsPage from "./pages/commercial/LeadsPage";
import {
  AutomationsPage,
  BroadcastPage,
  HistoryPage,
  KanbanPage,
  MetricsPage,
  ProductsPage,
  SdrPage,
} from "./pages/commercial/CommercialPlaceholders";
import { AgentsPage, AssistantsPage, ContentsPage, PromptsPage } from "./pages/ai/AiPlaceholders";
import { CashFlowPage, RevenuesPage } from "./pages/finance/FinancePlaceholders";
import { IntegrationsPage, SettingsPage } from "./pages/admin/AdminPlaceholders";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";
import AccessDeniedPage from "./pages/AccessDeniedPage";
import ProtectedRoute from "./components/ProtectedRoute";
import RicardoAccessControl from "./components/RicardoAccessControl";
import DebugEnv from "./components/DebugEnv";
// Removed PermissionProtectedRoute - no longer needed
import { useEffect } from "react";
import { CRMProvider } from "./contexts/CRMContext";
import { AppSettingsProvider } from "./contexts/AppSettingsContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import { trackPageView } from "./utils/analytics";

// Define routes configuration with Ricardo access control
const routes = [
  { path: "/login", element: <LoginPage />, protected: false, restrictedForRicardo: false },
  { path: "/forgot-password", element: <ForgotPasswordPage />, protected: false, restrictedForRicardo: false },
  { path: "/reset-password", element: <ResetPasswordPage />, protected: false, restrictedForRicardo: false },
  { path: "/", element: <Index />, protected: true, restrictedForRicardo: true },
  { path: "/dashboard", element: <Index />, protected: true, restrictedForRicardo: true },
  { path: "/projetos", element: <ProjetosPage />, protected: true, restrictedForRicardo: true },
  { path: "/briefings", element: <BriefingsPage />, protected: true, restrictedForRicardo: false },
  { path: "/codigos", element: <CodesPage />, protected: true, restrictedForRicardo: false },
  { path: "/acessos", element: <AcessosPage />, protected: true, restrictedForRicardo: false },
  { path: "/despesas", element: <DespesasPage />, protected: true, restrictedForRicardo: true },
  { path: "/crm", element: <CRMPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/leads", element: <LeadsPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/kanban", element: <KanbanPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/produtos", element: <ProductsPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/historico", element: <HistoryPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/prospeccao", element: <ProspectingPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/metricas", element: <MetricsPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/disparar", element: <BroadcastPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/sdr", element: <SdrPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/automacoes", element: <AutomationsPage />, protected: true, restrictedForRicardo: false },
  { path: "/operacional/briefings", element: <Navigate to="/briefings" replace />, protected: true, restrictedForRicardo: false },
  { path: "/operacional/codigos", element: <Navigate to="/codigos" replace />, protected: true, restrictedForRicardo: false },
  { path: "/operacional/acessos", element: <Navigate to="/acessos" replace />, protected: true, restrictedForRicardo: false },
  { path: "/ia/assistentes", element: <AssistantsPage />, protected: true, restrictedForRicardo: false },
  { path: "/ia/conteudos", element: <ContentsPage />, protected: true, restrictedForRicardo: false },
  { path: "/ia/prompts", element: <PromptsPage />, protected: true, restrictedForRicardo: false },
  { path: "/ia/agentes", element: <AgentsPage />, protected: true, restrictedForRicardo: false },
  { path: "/financeiro/projetos", element: <Navigate to="/projetos" replace />, protected: true, restrictedForRicardo: true },
  { path: "/financeiro/receitas", element: <RevenuesPage />, protected: true, restrictedForRicardo: true },
  { path: "/financeiro/despesas", element: <Navigate to="/despesas" replace />, protected: true, restrictedForRicardo: true },
  { path: "/financeiro/fluxo-de-caixa", element: <CashFlowPage />, protected: true, restrictedForRicardo: true },
  { path: "/administracao/usuarios", element: <Navigate to="/usuarios" replace />, protected: true, restrictedForRicardo: true },
  { path: "/administracao/integracoes", element: <IntegrationsPage />, protected: true, restrictedForRicardo: true },
  { path: "/administracao/configuracoes", element: <SettingsPage />, protected: true, restrictedForRicardo: true },
  { path: "/prospeccao", element: <Navigate to="/comercial/prospeccao" replace />, protected: true, restrictedForRicardo: false },
  { path: "/prospeccao/integracoes", element: <Navigate to="/administracao/integracoes" replace />, protected: true, restrictedForRicardo: false },
  { path: "/usuarios", element: <UsuariosPage />, protected: true, restrictedForRicardo: true },
  { path: "/access-denied", element: <AccessDeniedPage />, protected: true, restrictedForRicardo: false },
  { path: "*", element: <NotFound />, protected: false, restrictedForRicardo: false }
];

// Rotas restritas para Ricardo
const ricardoRestrictedPaths = routes
  .filter(route => route.restrictedForRicardo)
  .map(route => route.path);

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
      <div className="min-h-screen w-full max-w-full overflow-x-hidden">
        <Routes>
          {routes.map((route) => (
            <Route 
              key={route.path} 
              path={route.path} 
              element={route.protected ? (
                <ProtectedRoute>
                  <RicardoAccessControl restrictedPaths={ricardoRestrictedPaths}>
                    {route.element}
                  </RicardoAccessControl>
                </ProtectedRoute>
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
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
        <AppSidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          <header className="flex h-12 w-full items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <div className="flex-1 w-full max-w-full overflow-x-hidden">
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
                
                // All protected routes use ProtectedRoute with Ricardo access control
                return (
                  <Route 
                    key={route.path} 
                    path={route.path} 
                    element={
                      <ProtectedRoute>
                        <RicardoAccessControl restrictedPaths={ricardoRestrictedPaths}>
                          {route.element}
                        </RicardoAccessControl>
                      </ProtectedRoute>
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
            <HashRouter>
              <TooltipProvider>
                <AppLayout />
                <Toaster />
                <DebugEnv />
              </TooltipProvider>
            </HashRouter>
          </CRMProvider>
        </AppSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

