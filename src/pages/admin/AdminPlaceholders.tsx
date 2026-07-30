import { Plug, SlidersHorizontal } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";
import { IntegrationLibrary } from "@/components/integrations/IntegrationLibrary";

export function IntegrationsPage() {
  return <IntegrationLibrary />;
}

export function SettingsPage() {
  return <ModulePlaceholderPage title="Configuracoes" area="Administracao" icon={SlidersHorizontal} description="Ajuste preferencias e parametros do sistema." moduleSummary="Configuracoes sera a area para parametros globais, preferencias administrativas e controles de funcionamento do sistema interno." />;
}
