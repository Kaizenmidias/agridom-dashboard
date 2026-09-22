import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChartNoAxesCombined, MessagesSquare, PanelTop, Send, Workflow } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead, LeadStatus } from "@/types/lead";

const PIPELINE_STORAGE_KEY = "kaizen.pipeline.leads";

const pipelineColumns: Array<{ status: LeadStatus; title: string }> = [
  { status: "qualificado", title: "Qualificados" },
  { status: "reuniao", title: "Reunião" },
  { status: "proposta", title: "Proposta" },
  { status: "negociacao", title: "Negociação" },
  { status: "convertido", title: "Convertidos" },
];

function readPipelineLeads() {
  try {
    const stored = localStorage.getItem(PIPELINE_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Lead[]) : [];
  } catch {
    return [];
  }
}

export function ChatsPage() {
  return <ModulePlaceholderPage title="Chats" area="Comercial" icon={MessagesSquare} description="Centralize conversas comerciais." moduleSummary="A área Chats será utilizada para acompanhar conversas com leads e clientes, reunindo canais, histórico de atendimento e próximas ações do time comercial." />;
}

export function PipelinePage() {
  const [pipelineLeads, setPipelineLeads] = useState<Lead[]>([]);

  useEffect(() => {
    setPipelineLeads(readPipelineLeads());
  }, []);

  const groupedLeads = useMemo(
    () =>
      pipelineColumns.map((column) => ({
        ...column,
        leads: pipelineLeads.filter((lead) => lead.status === column.status),
      })),
    [pipelineLeads]
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Leads enviados do comercial para acompanhamento por etapa.</p>
      </div>

      {pipelineLeads.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="font-medium">Nenhum lead no pipeline</p>
          <p className="mt-1 text-sm text-muted-foreground">Use “Adicionar ao Kanban” na aba Leads para enviar oportunidades para cá.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          {groupedLeads.map((column) => (
            <Card key={column.status} className="min-h-[520px] rounded-lg shadow-none">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{column.title}</CardTitle>
                  <Badge variant="secondary">{column.leads.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-3">
                {column.leads.map((lead) => (
                  <div key={lead.id} className="rounded-md border bg-background p-3">
                    <p className="font-medium">{lead.companyName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{lead.contactName || "Sem contato informado"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{lead.score || 0}</Badge>
                      <Badge variant="outline">{[lead.city, lead.state].filter(Boolean).join(" / ") || "Sem cidade"}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
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
