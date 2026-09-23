import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChartNoAxesCombined, MessagesSquare, Pencil, Plus, Send, Trash2, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import type { Lead, LeadStatus } from "@/types/lead";

const LEADS_KEY = "kaizen.pipeline.leads";
const COLUMNS_KEY = "kaizen.pipeline.columns";
type PipelineColumn = { id: string; status: LeadStatus; title: string };
const defaults: PipelineColumn[] = [
  { id: "qualificado", status: "qualificado", title: "Qualificados" },
  { id: "reuniao", status: "reuniao", title: "Reuniao" },
  { id: "proposta", status: "proposta", title: "Proposta" },
  { id: "negociacao", status: "negociacao", title: "Negociacao" },
  { id: "convertido", status: "convertido", title: "Convertidos" },
];
const read = <T,>(key: string, fallback: T): T => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
const money = (lead: Lead) => {
  const legacyBudget = (lead as Lead & { budget?: string | number }).budget;
  const raw = lead.metadata?.budget ?? legacyBudget ?? "";
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const value = Number(String(raw).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
};
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ChatsPage() { return <ModulePlaceholderPage title="Chats" area="Comercial" icon={MessagesSquare} description="Centralize conversas comerciais." moduleSummary="A area Chats sera utilizada para acompanhar conversas com leads e clientes." />; }
export function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]); const [columns, setColumns] = useState(defaults); const [dragged, setDragged] = useState<Lead | null>(null); const [editing, setEditing] = useState<string | null>(null); const [name, setName] = useState(""); const { isAdmin } = useAuth();
  useEffect(() => { setLeads(read(LEADS_KEY, [])); setColumns(read(COLUMNS_KEY, defaults)); }, []);
  const saveColumns = (next: PipelineColumn[]) => { setColumns(next); localStorage.setItem(COLUMNS_KEY, JSON.stringify(next)); };
  const move = (lead: Lead, status: LeadStatus) => { const next = leads.map((item) => item.id === lead.id ? { ...item, status, updatedAt: new Date().toISOString() } : item); setLeads(next); localStorage.setItem(LEADS_KEY, JSON.stringify(next)); };
  const groups = useMemo(() => columns.map((column) => ({ ...column, leads: leads.filter((lead) => lead.status === column.status) })), [columns, leads]);
  const add = () => { const title = window.prompt("Nome da nova coluna")?.trim(); if (!title) return; const id = `custom-${Date.now()}`; saveColumns([...columns, { id, status: id as LeadStatus, title }]); };
  const rename = (column: PipelineColumn) => { if (!name.trim()) return; saveColumns(columns.map((item) => item.id === column.id ? { ...item, title: name.trim() } : item)); setEditing(null); };
  const remove = (column: PipelineColumn) => { if (!window.confirm(`Remover a coluna "${column.title}"?`)) return; const fallback = columns.find((item) => item.id !== column.id); const next = leads.map((lead) => lead.status === column.status && fallback ? { ...lead, status: fallback.status } : lead); setLeads(next); localStorage.setItem(LEADS_KEY, JSON.stringify(next)); saveColumns(columns.filter((item) => item.id !== column.id)); };
  return <div className="min-h-[calc(100vh-3.5rem)] bg-background p-4 md:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Pipeline</h1><p className="text-sm text-muted-foreground">Acompanhe os leads por etapa comercial.</p></div>{isAdmin ? <Button onClick={add}><Plus className="mr-2 h-4 w-4" />Nova coluna</Button> : null}</div>{leads.length === 0 ? <div className="rounded-md border border-dashed p-8 text-center"><p className="font-medium">Nenhum lead no pipeline</p><p className="mt-1 text-sm text-muted-foreground">Use “Adicionar ao Kanban” na aba Leads.</p></div> : <div className="flex gap-4 overflow-x-auto pb-4">{groups.map((column) => <Card key={column.id} className="min-h-[520px] min-w-[280px] flex-1 rounded-lg shadow-none" onDragOver={(event) => event.preventDefault()} onDrop={() => dragged && move(dragged, column.status)}><CardHeader className="border-b"><div className="flex items-start justify-between gap-2"><div>{editing === column.id ? <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && rename(column)} className="h-8" /> : <CardTitle className="text-sm">{column.title}</CardTitle>}<p className="mt-1 text-xs text-muted-foreground">{brl(column.leads.reduce((sum, lead) => sum + money(lead), 0))}</p></div><div className="flex items-center gap-1"><Badge variant="secondary">{column.leads.length}</Badge>{isAdmin ? <><Button variant="ghost" size="icon" onClick={() => { setEditing(column.id); setName(column.title); }}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" onClick={() => remove(column)}><Trash2 className="h-3.5 w-3.5" /></Button></> : null}</div></div></CardHeader><CardContent className="space-y-3 p-3">{column.leads.map((lead) => <Link key={lead.id} to={`/comercial/leads/${lead.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${lead.id}`} draggable onDragStart={() => setDragged(lead)} className="block rounded-md border bg-background p-3 transition hover:border-primary"><p className="font-medium">{lead.companyName}</p><p className="mt-1 text-xs text-muted-foreground">{lead.contactName || "Sem contato informado"}</p><p className="mt-2 text-sm font-semibold text-primary">{brl(money(lead))}</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{lead.score || 0}</Badge><Badge variant="outline">{[lead.city, lead.state].filter(Boolean).join(" / ") || "Sem cidade"}</Badge></div></Link>)}</CardContent></Card>)}</div>}</div>;
}
export function MetricsPage() { return <ModulePlaceholderPage title="Metricas" area="Comercial" icon={ChartNoAxesCombined} description="Monitore indicadores da maquina comercial." moduleSummary="Acompanhe volume de leads, conversoes e produtividade." />; }
export function BroadcastPage() { return <ModulePlaceholderPage title="Disparar" area="Comercial" icon={Send} description="Prepare disparos comerciais segmentados." moduleSummary="Organize campanhas de contato comercial." />; }
export function AutomationsPage() { return <ModulePlaceholderPage title="Automacoes" area="Comercial" icon={Workflow} description="Gerencie fluxos comerciais automatizados." moduleSummary="Conecte eventos comerciais e tarefas recorrentes." />; }
export function AgendaPage() { return <ModulePlaceholderPage title="Agenda" area="Comercial" icon={CalendarDays} description="Organize compromissos e proximas atividades." moduleSummary="Registre reunioes, retornos e follow-ups." />; }
