import { CalendarDays, ChartNoAxesCombined, MessagesSquare, PanelTop, Send, Workflow } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function ChatsPage() {
  return <ModulePlaceholderPage title="Chats" area="Comercial" icon={MessagesSquare} description="Centralize conversas comerciais." moduleSummary="A área Chats será utilizada para acompanhar conversas com leads e clientes, reunindo canais, histórico de atendimento e próximas ações do time comercial." />;
}

export function PipelinePage() {
  return <ModulePlaceholderPage title="Pipeline" area="Comercial" icon={PanelTop} description="Acompanhe oportunidades comerciais por etapa." moduleSummary="O Pipeline comercial será utilizado para visualizar leads qualificados, oportunidades em negociação, propostas enviadas e próximas ações do time." />;
}

export function MetricsPage() {
  return <ModulePlaceholderPage title="Métricas" area="Comercial" icon={ChartNoAxesCombined} description="Monitore indicadores da máquina comercial." moduleSummary="O módulo Métricas será utilizado para acompanhar volume de leads, conversões, produtividade, origem de oportunidades e desempenho por período." />;
}

export function BroadcastPage() {
  return <ModulePlaceholderPage title="Disparar" area="Comercial" icon={Send} description="Prepare disparos comerciais segmentados." moduleSummary="A área Disparar organizará campanhas de contato por WhatsApp, e-mail e outras cadências, respeitando filtros e critérios de segmentação dos leads." />;
}

export function AutomationsPage() {
  return <ModulePlaceholderPage title="Automações" area="Comercial" icon={Workflow} description="Gerencie fluxos comerciais automatizados." moduleSummary="Automações conectará eventos comerciais, entrada de leads pelo n8n, tarefas recorrentes e atualizações de status entre os módulos." />;
}

export function AgendaPage() {
  return <ModulePlaceholderPage title="Agenda" area="Comercial" icon={CalendarDays} description="Organize compromissos e próximas atividades." moduleSummary="A Agenda comercial será utilizada para registrar reuniões, retornos, follow-ups, vencimentos de propostas e atividades do time." />;
}
