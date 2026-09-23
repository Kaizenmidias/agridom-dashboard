import { CalendarDays, ChartNoAxesCombined, MessagesSquare, Send, Workflow } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function ChatsPage() {
  return <ModulePlaceholderPage title="Chats" area="Comercial" icon={MessagesSquare} description="Centralize conversas comerciais." moduleSummary="A área Chats será utilizada para acompanhar conversas com Leads e clientes." />;
}

export function MetricsPage() {
  return <ModulePlaceholderPage title="Métricas" area="Comercial" icon={ChartNoAxesCombined} description="Monitore indicadores da máquina comercial." moduleSummary="Acompanhe volume de Leads, conversões e produtividade." />;
}

export function BroadcastPage() {
  return <ModulePlaceholderPage title="Disparar" area="Comercial" icon={Send} description="Prepare disparos comerciais segmentados." moduleSummary="Organize campanhas de contato comercial." />;
}

export function AutomationsPage() {
  return <ModulePlaceholderPage title="Automações" area="Comercial" icon={Workflow} description="Gerencie fluxos comerciais automatizados." moduleSummary="Conecte eventos comerciais e tarefas recorrentes." />;
}

export function AgendaPage() {
  return <ModulePlaceholderPage title="Agenda" area="Comercial" icon={CalendarDays} description="Organize compromissos e próximas atividades." moduleSummary="Registre reuniões, retornos e follow-ups." />;
}
