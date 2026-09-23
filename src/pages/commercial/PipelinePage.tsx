import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getLeads } from "@/services/leads/lead-service";
import { commercialEntitiesAPI, type PipelineDefinition, type PipelinePosition, type PipelineStage } from "@/services/commercial-entities";
import type { Lead } from "@/types/lead";

const LEGACY_LEADS_KEY = "kaizen.pipeline.leads";
const LEGACY_COLUMNS_KEY = "kaizen.pipeline.columns";

function budgetValue(lead: Lead) {
  const raw = lead.metadata?.budget ?? "";
  const value = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PipelinePage() {
  const { isAdmin } = useAuth();
  const [pipeline, setPipeline] = useState<PipelineDefinition | null>(null);
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [positions, setPositions] = useState<PipelinePosition[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dragged, setDragged] = useState<Lead | null>(null);
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [stageName, setStageName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [pipelineData, leadData] = await Promise.all([commercialEntitiesAPI.getPipelines(), getLeads()]);
      const current = pipelineData.pipelines.find((item) => Boolean(item.is_default)) || pipelineData.pipelines[0] || null;
      setPipelines(pipelineData.pipelines);
      setPipeline(current);
      setStages(current ? pipelineData.stages.filter((item) => item.pipeline_id === current.id) : []);
      setPositions(current ? pipelineData.positions.filter((item) => item.pipeline_id === current.id) : []);
      setLeads(leadData);

      if (current && localStorage.getItem(LEGACY_LEADS_KEY)) await importLegacyPipeline(current, pipelineData.stages);
    } finally { setLoading(false); }
  };

  const importLegacyPipeline = async (current: PipelineDefinition, currentStages: PipelineStage[]) => {
    const raw = localStorage.getItem(LEGACY_LEADS_KEY);
    if (!raw) return;
    try {
      const legacy = JSON.parse(raw) as Lead[];
      const legacyColumnsRaw = localStorage.getItem(LEGACY_COLUMNS_KEY);
      const legacyColumns = legacyColumnsRaw ? JSON.parse(legacyColumnsRaw) as Array<{ status: string; title: string }> : [];
      let migrationStages = currentStages.filter((item) => item.pipeline_id === current.id);
      for (const column of legacyColumns) {
        if (migrationStages.some((item) => item.name.toLocaleLowerCase("pt-BR") === column.title.toLocaleLowerCase("pt-BR"))) continue;
        const created = await commercialEntitiesAPI.createStage(current.id, column.title);
        migrationStages = [...migrationStages, created];
      }
      const statusNames: Record<string, string> = { qualificado: "Qualificados", reuniao: "Reuniao", proposta: "Proposta", negociacao: "Negociacao", convertido: "Convertidos" };
      const items = legacy.map((lead, index) => {
        const targetName = legacyColumns.find((item) => item.status === lead.status)?.title || statusNames[lead.status] || "Qualificados";
        const stage = migrationStages.find((item) => item.name.localeCompare(targetName, "pt-BR", { sensitivity: "base" }) === 0);
        return stage ? { prospect_id: lead.id, stage_id: stage.id, sort_order: index } : null;
      }).filter((item): item is { prospect_id: string; stage_id: number; sort_order: number } => Boolean(item));
      if (items.length) await commercialEntitiesAPI.importLocalPipeline(current.id, items);
      localStorage.removeItem(LEGACY_LEADS_KEY);
      localStorage.removeItem(LEGACY_COLUMNS_KEY);
      const refreshed = await commercialEntitiesAPI.getPipelines();
      setStages(refreshed.stages.filter((item) => item.pipeline_id === current.id));
      setPositions(refreshed.positions.filter((item) => item.pipeline_id === current.id));
    } catch { /* Mantem o dado local para uma nova tentativa. */ }
  };

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => stages.map((stage) => ({
    ...stage,
    leads: positions.filter((position) => position.stage_id === stage.id).sort((a, b) => a.sort_order - b.sort_order).map((position) => leads.find((lead) => lead.id === String(position.prospect_id))).filter((lead): lead is Lead => Boolean(lead)),
  })), [stages, positions, leads]);

  const moveLead = async (lead: Lead, stageId: number) => {
    if (!pipeline) return;
    const previous = positions;
    const existing = positions.find((item) => String(item.prospect_id) === lead.id);
    const optimistic: PipelinePosition = existing ? { ...existing, stage_id: stageId } : { id: Date.now(), prospect_id: Number(lead.id), pipeline_id: pipeline.id, stage_id: stageId, sort_order: 0 };
    setPositions([...positions.filter((item) => String(item.prospect_id) !== lead.id), optimistic]);
    try {
      const saved = await commercialEntitiesAPI.moveLead(pipeline.id, lead.id, stageId);
      setPositions((current) => [...current.filter((item) => String(item.prospect_id) !== lead.id), saved]);
    } catch { setPositions(previous); }
  };

  const createStage = async () => {
    if (!pipeline) return;
    const name = window.prompt("Nome da nova coluna")?.trim();
    if (!name) return;
    const stage = await commercialEntitiesAPI.createStage(pipeline.id, name);
    setStages((current) => [...current, stage]);
  };

  const createPipeline = async () => {
    const name = window.prompt("Nome da nova Pipeline")?.trim();
    if (!name) return;
    const created = await commercialEntitiesAPI.createPipeline(name);
    setPipelines((current) => [...current, created]);
    setPipeline(created);
    setStages([]);
    setPositions([]);
  };

  const selectPipeline = async (id: string) => {
    const data = await commercialEntitiesAPI.getPipelines();
    const selected = data.pipelines.find((item) => String(item.id) === id) || null;
    setPipeline(selected);
    setStages(selected ? data.stages.filter((item) => item.pipeline_id === selected.id) : []);
    setPositions(selected ? data.positions.filter((item) => item.pipeline_id === selected.id) : []);
  };

  const renameStage = async (stage: PipelineStage) => {
    if (!stageName.trim()) return;
    const updated = await commercialEntitiesAPI.updateStage(stage.id, { name: stageName.trim() });
    setStages((current) => current.map((item) => item.id === stage.id ? updated : item));
    setEditingStage(null);
  };

  const removeStage = async (stage: PipelineStage) => {
    if (!window.confirm(`Remover a coluna "${stage.name}"?`)) return;
    await commercialEntitiesAPI.deleteStage(stage.id);
    setStages((current) => current.filter((item) => item.id !== stage.id));
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando Pipeline...</div>;

  return <div className="min-h-[calc(100vh-3.5rem)] bg-background p-4 md:p-6">
    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h1 className="text-2xl font-semibold">Pipeline</h1><p className="text-sm text-muted-foreground">Acompanhe os Leads por etapa comercial.</p></div><div className="flex flex-wrap gap-2"><Select value={pipeline ? String(pipeline.id) : undefined} onValueChange={(value) => void selectPipeline(value)}><SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione a Pipeline" /></SelectTrigger><SelectContent>{pipelines.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>{isAdmin ? <><Button variant="outline" onClick={() => void createPipeline()}><Plus className="mr-2 h-4 w-4" />Nova Pipeline</Button><Button onClick={() => void createStage()} disabled={!pipeline}><Plus className="mr-2 h-4 w-4" />Nova coluna</Button></> : null}</div></div>
    <div className="flex gap-4 overflow-x-auto pb-4">{grouped.map((stage) => <Card key={stage.id} className="min-h-[520px] min-w-[280px] flex-1 rounded-lg shadow-none" onDragOver={(event) => event.preventDefault()} onDrop={() => dragged && void moveLead(dragged, stage.id)}>
      <CardHeader className="border-b"><div className="flex items-start justify-between gap-2"><div>{editingStage === stage.id ? <Input autoFocus value={stageName} onChange={(event) => setStageName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void renameStage(stage)} className="h-8" /> : <CardTitle className="text-sm">{stage.name}</CardTitle>}<p className="mt-1 text-xs text-muted-foreground">{formatBRL(stage.leads.reduce((sum, lead) => sum + budgetValue(lead), 0))}</p></div><div className="flex items-center gap-1"><Badge variant="secondary">{stage.leads.length}</Badge>{isAdmin ? <><Button variant="ghost" size="icon" title="Renomear" onClick={() => { setEditingStage(stage.id); setStageName(stage.name); }}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" title="Remover" onClick={() => void removeStage(stage)}><Trash2 className="h-3.5 w-3.5" /></Button></> : null}</div></div></CardHeader>
      <CardContent className="space-y-3 p-3">{stage.leads.map((lead) => <Link key={lead.id} to={`/comercial/leads/${lead.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${lead.id}`} draggable onDragStart={() => setDragged(lead)} className="block rounded-md border bg-background p-3 transition hover:border-primary"><p className="font-medium">{lead.companyName}</p><p className="mt-1 text-xs text-muted-foreground">{lead.contactName || "Sem contato informado"}</p><p className="mt-2 text-sm font-semibold text-primary">{formatBRL(budgetValue(lead))}</p><div className="mt-3 flex gap-2"><Badge variant="outline">{lead.score || 0}</Badge><Badge variant="outline">{[lead.city, lead.state].filter(Boolean).join(" / ") || "Sem cidade"}</Badge></div></Link>)}</CardContent>
    </Card>)}</div>
  </div>;
}
