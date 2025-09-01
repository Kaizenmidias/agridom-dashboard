
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import ProjetosPage from "./pages/ProjetosPage";
import DespesasPage from "./pages/DespesasPage";
import CRMPage from "./pages/CRMPage";
import UsuariosPage from "./pages/UsuariosPage";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { CRMProvider } from "./contexts/CRMContext";
import { StatisticsProvider } from "./contexts/StatisticsContext";
import { AppSettingsProvider } from "./contexts/AppSettingsContext";
import { trackPageView } from "./utils/analytics";

// Define routes configuration
const routes = [
  { path: "/", element: <Index /> },
  { path: "/projetos", element: <ProjetosPage /> },
  { path: "/despesas", element: <DespesasPage /> },
  { path: "/crm", element: <CRMPage /> },
  { path: "/usuarios", element: <UsuariosPage /> },
  { path: "*", element: <NotFound /> }
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

// Application main component with sidebar layout
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <CRMProvider>
          <BrowserRouter>
            <TooltipProvider>
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
                            element={route.element} 
                          />
                        ))}
                      </Routes>
                    </div>
                  </main>
                </div>
              </SidebarProvider>
              <Toaster />
            </TooltipProvider>
          </BrowserRouter>
        </CRMProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
};

export default App;
