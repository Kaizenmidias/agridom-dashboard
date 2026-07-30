import { Plug, SlidersHorizontal } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";
import { IntegrationLibrary } from "@/components/integrations/IntegrationLibrary";

export function IntegrationsPage() {
  return <IntegrationLibrary />;
}

export function SettingsPage() {
  return <ModulePlaceholderPage title="Configurações" area="Administração" icon={SlidersHorizontal} description="Ajuste preferências e parâmetros do sistema." moduleSummary="Configurações será a área para parâmetros globais, preferências administrativas e controles de funcionamento do sistema interno." />;
}

