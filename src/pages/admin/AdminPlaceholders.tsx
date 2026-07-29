import { Plug, SlidersHorizontal } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function IntegrationsPage() {
  return <ModulePlaceholderPage title="Integracoes" area="Administracao" icon={Plug} description="Gerencie conexoes internas e servicos externos." moduleSummary="Integracoes concentrara configuracoes de APIs, webhooks, n8n e conectores operacionais usados pelos modulos internos." />;
}

export function SettingsPage() {
  return <ModulePlaceholderPage title="Configuracoes" area="Administracao" icon={SlidersHorizontal} description="Ajuste preferencias e parametros do sistema." moduleSummary="Configuracoes sera a area para parametros globais, preferencias administrativas e controles de funcionamento do sistema interno." />;
}
