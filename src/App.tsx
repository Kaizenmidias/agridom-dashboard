
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Bell, Search, Settings } from "lucide-react";
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
import LeadDetailPage from "./pages/commercial/LeadDetailPage";
import {
  AgendaPage,
  AutomationsPage,
  BroadcastPage,
  ChatsPage,
  MetricsPage,
  PipelinePage,
} from "./pages/commercial/CommercialPlaceholders";
import { AgentsPage, AssistantsPage, ContentsPage, PromptsPage } from "./pages/ai/AiPlaceholders";
import { CashFlowPage, RevenuesPage } from "./pages/finance/FinancePlaceholders";
import { ContractsPage } from "./pages/legal/LegalPlaceholders";
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
import { CRMProvider } from "./contexts/CRMContext";
import { AppSettingsProvider } from "./contexts/AppSettingsContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

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
  { path: "/comercial/chats", element: <ChatsPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/leads", element: <LeadsPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/leads/:leadSlug", element: <LeadDetailPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/pipeline", element: <PipelinePage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/prospeccao", element: <ProspectingPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/metricas", element: <MetricsPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/disparar", element: <BroadcastPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/automacoes", element: <AutomationsPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/agenda", element: <AgendaPage />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/kanban", element: <Navigate to="/comercial/pipeline" replace />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/produtos", element: <Navigate to="/comercial/leads" replace />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/histórico", element: <Navigate to="/comercial/chats" replace />, protected: true, restrictedForRicardo: false },
  { path: "/comercial/sdr", element: <Navigate to="/comercial/leads" replace />, protected: true, restrictedForRicardo: false },
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
  { path: "/juridico/contratos", element: <ContractsPage />, protected: true, restrictedForRicardo: true },
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
// Nginx configuration handles SPA routing with rewrites

// Layout component that conditionally shows sidebar
const AppLayout = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const topbarDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
  
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
          <header className="sticky top-0 z-20 flex h-14 w-full items-center gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl">
            <SidebarTrigger className="text-muted-foreground hover:bg-white/5 hover:text-foreground" />
            <div className="relative hidden w-full max-w-md md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Pesquisar em todo o sistema..."
                className="h-8 w-full rounded-md border border-input bg-card/70 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-[11px] font-medium capitalize text-muted-foreground lg:inline">{topbarDate}</span>
              <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground" type="button">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive" />
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground" type="button">
                <Settings className="h-4 w-4" />
              </button>
              <div className="hidden items-center gap-2 rounded-md px-2 py-1 md:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {(user?.full_name || user?.name || "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-semibold text-foreground">{user?.full_name || user?.name || "Usuário"}</p>
                  <p className="text-[10px] text-muted-foreground">{user?.role || "Administrador"}</p>
                </div>
              </div>
            </div>
          </header>
          <div className="flex-1 w-full max-w-full overflow-x-hidden bg-background">
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
