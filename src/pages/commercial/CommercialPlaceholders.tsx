import { Braces, ChartNoAxesCombined, Columns3, Headphones, History, Package, Send, Workflow } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function KanbanPage() {
  return <ModulePlaceholderPage title="Kanban" area="Comercial" icon={Columns3} description="Acompanhe oportunidades comerciais por etapa." moduleSummary="O Kanban comercial sera utilizado para visualizar leads qualificados, oportunidades em negociacao, propostas enviadas e proximas acoes do time." />;
}

export function ProductsPage() {
  return <ModulePlaceholderPage title="Produtos" area="Comercial" icon={Package} description="Organize ofertas, servicos e pacotes comerciais." moduleSummary="O modulo Produtos centralizara os itens comercializados pela Kaizen, com informacoes de posicionamento, precificacao e criterios de venda." />;
}

export function HistoryPage() {
  return <ModulePlaceholderPage title="Historico" area="Comercial" icon={History} description="Consulte interacoes e movimentacoes comerciais." moduleSummary="O Historico reunira contatos, mudancas de status, atividades de abordagem e registros importantes para auditoria do relacionamento comercial." />;
}

export function MetricsPage() {
  return <ModulePlaceholderPage title="Metricas" area="Comercial" icon={ChartNoAxesCombined} description="Monitore indicadores da maquina comercial." moduleSummary="O modulo Metricas sera utilizado para acompanhar volume de leads, conversoes, produtividade de SDR, origem de oportunidades e desempenho por periodo." />;
}

export function BroadcastPage() {
  return <ModulePlaceholderPage title="Disparar" area="Comercial" icon={Send} description="Prepare disparos comerciais segmentados." moduleSummary="A area Disparar organizara campanhas de contato por WhatsApp, e-mail e outras cadencias, respeitando filtros e criterios de segmentacao dos leads." />;
}

export function SdrPage() {
  return <ModulePlaceholderPage title="SDR" area="Comercial" icon={Headphones} description="Central de qualificacao e abordagem comercial." moduleSummary="O modulo SDR sera utilizado para organizar filas de contato, cadencias, acompanhamento de abordagens e criterios de qualificacao comercial." />;
}

export function AutomationsPage() {
  return <ModulePlaceholderPage title="Automacoes" area="Comercial" icon={Workflow} description="Gerencie fluxos comerciais automatizados." moduleSummary="Automacoes conectara eventos comerciais, entrada de leads pelo n8n, tarefas recorrentes e atualizacoes de status entre os modulos." />;
}

export function ProspectingAliasPage() {
  return <ModulePlaceholderPage title="Prospeccao" area="Comercial" icon={Braces} description="Rota agrupada para compatibilidade comercial." moduleSummary="Esta rota visual pertence ao grupo Comercial e mantem compatibilidade com o modulo de prospeccao existente." />;
}

