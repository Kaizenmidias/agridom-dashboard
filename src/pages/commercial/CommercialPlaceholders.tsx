import { CalendarDays, ChartNoAxesCombined, MessagesSquare, PanelTop, Send, Workflow } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function ChatsPage() {
  return <ModulePlaceholderPage title="Chats" area="Comercial" icon={MessagesSquare} description="Centralize conversas comerciais." moduleSummary="A area Chats sera utilizada para acompanhar conversas com leads e clientes, reunindo canais, historico de atendimento e proximas acoes do time comercial." />;
}

export function PipelinePage() {
  return <ModulePlaceholderPage title="Pipeline" area="Comercial" icon={PanelTop} description="Acompanhe oportunidades comerciais por etapa." moduleSummary="O Pipeline comercial sera utilizado para visualizar leads qualificados, oportunidades em negociacao, propostas enviadas e proximas acoes do time." />;
}

export function MetricsPage() {
  return <ModulePlaceholderPage title="Métricas" area="Comercial" icon={ChartNoAxesCombined} description="Monitore indicadores da maquina comercial." moduleSummary="O modulo Metricas sera utilizado para acompanhar volume de leads, conversoes, produtividade, origem de oportunidades e desempenho por periodo." />;
}

export function BroadcastPage() {
  return <ModulePlaceholderPage title="Disparar" area="Comercial" icon={Send} description="Prepare disparos comerciais segmentados." moduleSummary="A area Disparar organizara campanhas de contato por WhatsApp, e-mail e outras cadencias, respeitando filtros e criterios de segmentacao dos leads." />;
}

export function AutomationsPage() {
  return <ModulePlaceholderPage title="Automações" area="Comercial" icon={Workflow} description="Gerencie fluxos comerciais automatizados." moduleSummary="Automacoes conectara eventos comerciais, entrada de leads pelo n8n, tarefas recorrentes e atualizacoes de status entre os modulos." />;
}

export function AgendaPage() {
  return <ModulePlaceholderPage title="Agenda" area="Comercial" icon={CalendarDays} description="Organize compromissos e proximas atividades." moduleSummary="A Agenda comercial sera utilizada para registrar reunioes, retornos, follow-ups, vencimentos de propostas e atividades do time." />;
}
