import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  reconnectEdge,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Copy,
  GitBranch,
  GripVertical,
  LayoutDashboard,
  Minus,
  Move,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  UserRound,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { whatsappAPI, type WhatsAppAccount } from "@/api/whatsapp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ACTION_CATALOG,
  AVAILABILITY_LABELS,
  CATEGORY_LABELS,
  type ActionCatalogItem,
} from "./action-catalog";
import {
  commercialEntitiesAPI,
  type PipelineDefinition,
  type PipelineStage,
  type UserOption,
} from "@/services/commercial-entities";
import {
  automationsAPI,
  type AutomationDefinition,
  type AutomationVersion,
} from "@/services/automations";

type BuilderType = "trigger" | "condition" | "wait" | "action" | "finish";
export type BuilderNode = {
  id: string;
  type: BuilderType;
  label: string;
  config: Record<string, unknown>;
  x: number;
  y: number;
  next?: string | null;
  branches?: { yes?: string | null; no?: string | null };
};

const triggers: Record<string, string> = {
  "lead.created": "Lead criado",
  "lead.updated": "Lead atualizado",
  "lead.status_changed": "Status alterado",
  "lead.pipeline_stage_changed": "Etapa da pipeline alterada",
  "lead.tag_added": "Etiqueta adicionada",
  "lead.tag_removed": "Etiqueta removida",
  "lead.assigned": "Responsavel atribuido",
  "lead.converted": "Lead convertido",
  "activity.created": "Atividade criada",
  "activity.completed": "Atividade concluida",
};
const actions: Record<string, string> = {
  "lead.update_status": "Atualizar status",
  "lead.move_pipeline_stage": "Mover para etapa",
  "lead.add_tag": "Adicionar etiqueta",
  "lead.remove_tag": "Remover etiqueta",
  "lead.assign_user": "Atribuir responsavel",
  "activity.create": "Criar atividade",
};
const nodeMeta: Record<
  BuilderType,
  { title: string; color: string; icon: typeof Activity }
> = {
  trigger: {
    title: "Gatilho",
    color: "border-primary/60 bg-primary/10",
    icon: Sparkles,
  },
  condition: {
    title: "Condicao",
    color: "border-violet-400/60 bg-violet-400/10",
    icon: GitBranch,
  },
  wait: {
    title: "Aguardar",
    color: "border-amber-400/60 bg-amber-400/10",
    icon: Clock3,
  },
  action: {
    title: "Acao",
    color: "border-sky-400/60 bg-sky-400/10",
    icon: Activity,
  },
  finish: {
    title: "Finalizar",
    color: "border-emerald-400/60 bg-emerald-400/10",
    icon: Check,
  },
};

const defaultConfig = (type: BuilderType): Record<string, unknown> =>
  type === "condition"
    ? { field: "status", operator: "equals", value: "" }
    : type === "wait"
      ? { amount: 1, unit: "hours" }
      : type === "action"
        ? {
            actionType: "lead.add_tag",
            labelId: "",
            userId: "",
            stageId: "",
            title: "",
            description: "",
          }
        : {};

export function definitionToBuilder(
  definition: AutomationDefinition,
): BuilderNode[] {
  const steps = Array.isArray(definition.steps) ? definition.steps : [];
  const nodes: BuilderNode[] = [
    {
      id: "trigger_1",
      type: "trigger",
      label: triggers[definition.trigger.type] || definition.trigger.type,
      config: {
        ...definition.trigger.config,
        triggerType: definition.trigger.type,
      },
      x: 80,
      y: 210,
    },
  ];
  steps.forEach((step, index) => {
    const type = step.type as BuilderType;
    if (!["condition", "wait", "action", "finish"].includes(type)) return;
    nodes.push({
      id: String(step.id || `step_${index + 1}`),
      type,
      label:
        type === "condition"
          ? "Verificar condicao"
          : type === "wait"
            ? "Aguardar"
            : type === "action"
              ? actions[
                  String((step.config as Record<string, unknown>)?.actionType)
                ] || "Executar acao"
              : "Finalizar",
      config: { ...((step.config as Record<string, unknown>) || {}) },
      x: 360 + index * 280,
      y: type === "condition" ? 210 : 210,
      next: step.next as string | null | undefined,
      branches: step.branches as BuilderNode["branches"],
    });
  });
  const known = new Set(nodes.map((node) => node.id));
  nodes.forEach((node, index) => {
    if (node.type !== "trigger" && !node.next && !node.branches)
      node.next = nodes[index + 1]?.id || null;
  });
  if (!nodes.some((node) => node.type === "finish"))
    nodes.push({
      id: "finish_1",
      type: "finish",
      label: "Finalizar",
      config: {},
      x: 360 + steps.length * 280,
      y: 210,
    });
  const targetIds = new Set(nodes.map((node) => node.id));
  nodes.forEach((node, index) => {
    if (node.type === "trigger") node.next = nodes[1]?.id || "finish_1";
    if (node.next && !targetIds.has(node.next))
      node.next = index < nodes.length - 1 ? nodes[index + 1].id : "finish_1";
    if (node.branches) {
      node.branches.yes =
        node.branches.yes && targetIds.has(node.branches.yes)
          ? node.branches.yes
          : null;
      node.branches.no =
        node.branches.no && targetIds.has(node.branches.no)
          ? node.branches.no
          : null;
    }
  });
  return nodes;
}

export function builderToDefinition(
  nodes: BuilderNode[],
  triggerType?: string,
): AutomationDefinition {
  const trigger = nodes.find((node) => node.type === "trigger");
  return {
    schemaVersion: 1,
    trigger: {
      type: String(
        trigger?.config.triggerType || triggerType || "lead.created",
      ),
      config: Object.fromEntries(
        Object.entries(trigger?.config || {}).filter(
          ([key]) => key !== "triggerType",
        ),
      ),
    },
    steps: nodes
      .filter((node) => node.type !== "trigger")
      .map((node) => ({
        id: node.id,
        type: node.type,
        config: node.config,
        next: node.next ?? null,
        ...(node.type === "condition"
          ? { branches: node.branches || { yes: null, no: null } }
          : {}),
      })),
  };
}

function nextOf(node: BuilderNode, branch?: "yes" | "no") {
  return branch ? node.branches?.[branch] || null : node.next || null;
}

type FlowNodeData = BuilderNode;
type FlowNode = Node<FlowNodeData, "kaizen">;

const flowNodeTypes = { kaizen: KaizenFlowNode };

function flowDefinition(definition: AutomationDefinition): { nodes: FlowNode[]; edges: Edge[] } {
  const steps = Array.isArray(definition.steps) ? definition.steps : [];
  const legacyTriggerNext = (definition.trigger as AutomationDefinition["trigger"] & { next?: string | null }).next || (!Object.prototype.hasOwnProperty.call(definition, "layout") ? steps[0]?.id : null);
  if (!steps.length) return { nodes: [], edges: [] };
  const layout = (definition as AutomationDefinition & { layout?: { nodes?: Record<string, { x?: number; y?: number }> } }).layout?.nodes || {};
  const nodes: FlowNode[] = [
    {
      id: "trigger_1",
      type: "kaizen",
      position: { x: layout.trigger_1?.x ?? 80, y: layout.trigger_1?.y ?? 220 },
      data: {
        id: "trigger_1",
        type: "trigger",
        label: triggers[definition.trigger.type] || definition.trigger.type,
        config: { ...definition.trigger.config, triggerType: definition.trigger.type },
        next: legacyTriggerNext || null,
        x: layout.trigger_1?.x ?? 80,
        y: layout.trigger_1?.y ?? 220,
      },
    },
    ...steps.filter((step) => ["condition", "wait", "action", "finish"].includes(String(step.type))).map((step, index) => {
      const type = step.type as BuilderType;
      const config = { ...((step.config as Record<string, unknown>) || {}) };
      const id = String(step.id || `step_${index + 1}`);
      const position = layout[id] || { x: 360 + (index % 4) * 300, y: 180 + Math.floor(index / 4) * 180 };
      return {
        id,
        type: "kaizen" as const,
        position: { x: position.x ?? 360, y: position.y ?? 180 },
        data: {
          id,
          type,
          config,
          label: type === "condition" ? "Verificar condição" : type === "wait" ? "Aguardar" : type === "action" ? ACTION_CATALOG.find((item) => item.id === String(config.actionType))?.name || "Executar ação" : "Finalizar",
          x: position.x ?? 360,
          y: position.y ?? 180,
          next: step.next as string | null | undefined,
          branches: step.branches as BuilderNode["branches"],
        },
      };
    }),
  ];
  const known = new Set(nodes.map((node) => node.id));
  const edges: Edge[] = [];
  const addFlowEdge = (source: string, target: string | null | undefined, sourceHandle?: string) => {
    if (!target || !known.has(target) || source === target) return;
    edges.push({ id: `${source}-${sourceHandle || "next"}-${target}`, source, target, sourceHandle, targetHandle: "input", type: "smoothstep", label: sourceHandle === "yes" ? "SIM" : sourceHandle === "no" ? "NÃO" : undefined, style: { cursor: "pointer" }, data: { branch: sourceHandle } });
  };
  nodes.forEach((node) => {
    if (node.data.type === "trigger" || node.data.type === "action" || node.data.type === "wait" || node.data.type === "finish") addFlowEdge(node.id, node.data.next);
    if (node.data.type === "condition") {
      addFlowEdge(node.id, node.data.branches?.yes, "yes");
      addFlowEdge(node.id, node.data.branches?.no, "no");
    }
  });
  return { nodes, edges };
}

function definitionFromFlow(nodes: FlowNode[], edges: Edge[], triggerType: string): AutomationDefinition {
  const trigger = nodes.find((node) => node.data.type === "trigger");
  const steps = nodes.filter((node) => node.data.type !== "trigger").map((node) => {
    const outgoing = edges.filter((edge) => edge.source === node.id);
    const next = outgoing.find((edge) => edge.sourceHandle !== "yes" && edge.sourceHandle !== "no")?.target || null;
    return {
      id: node.id,
      type: node.data.type,
      config: node.data.config,
      next: node.data.type === "condition" ? null : next,
      ...(node.data.type === "condition" ? {
        branches: {
          yes: outgoing.find((edge) => edge.sourceHandle === "yes")?.target || null,
          no: outgoing.find((edge) => edge.sourceHandle === "no")?.target || null,
        },
      } : {}),
    };
  });
  return {
    schemaVersion: 1,
    trigger: {
      type: String(trigger?.data.config.triggerType || triggerType || "lead.created"),
      config: Object.fromEntries(Object.entries(trigger?.data.config || {}).filter(([key]) => key !== "triggerType")),
      next: trigger ? edges.find((edge) => edge.source === trigger.id && edge.sourceHandle !== "yes" && edge.sourceHandle !== "no")?.target || null : null,
    },
    steps,
    layout: {
      nodes: Object.fromEntries(nodes.map((node) => [node.id, { x: node.position.x, y: node.position.y }])),
    },
  } as AutomationDefinition;
}

function KaizenFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const meta = nodeMeta[data.type];
  const Icon = meta.icon;
  const action = data.type === "action" ? ACTION_CATALOG.find((item) => item.id === String(data.config.actionType)) : null;
  const summary = data.type === "trigger"
    ? "Quando este evento acontecer"
    : data.type === "condition"
      ? `${String(data.config.field || "Campo")} ${String(data.config.operator || "é igual a").replaceAll("_", " ")}${data.config.value ? ` ${String(data.config.value)}` : ""}`
      : data.type === "wait"
        ? `${String(data.config.amount || 1)} ${String(data.config.unit || "hours").replace("hours", "horas").replace("minutes", "minutos").replace("days", "dias")}`
        : data.type === "action"
          ? action?.description || "Configure esta ação"
          : "Fim deste caminho";
  const incomplete = data.type === "action" && ["lead.add_tag", "lead.remove_tag"].includes(String(data.config.actionType)) && !data.config.labelId;
  return (
    <div className={`group relative w-[264px] rounded-xl border bg-[#181A1F] p-4 text-[#F4F5F7] shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl ${meta.color} ${selected ? "ring-2 ring-[#B7FF3C] ring-offset-2 ring-offset-[#0E1013]" : ""}`}>
      {data.type !== "trigger" ? <Handle type="target" position={Position.Left} id="input" className="!h-3 !w-3 !border-2 !border-[#0A0A0A] !bg-[#B7FF3C]" /> : null}
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-1 rounded-md border border-white/10 bg-[#181A1F] p-1 shadow-xl">
        <span className="px-1 text-[10px] text-[#9CA3AF]">Clique para configurar</span>
      </NodeToolbar>
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-[#0A0A0A] p-1.5"><Icon className="h-4 w-4 text-[#B7FF3C]" /></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">{meta.title}</p><p className="mt-1 truncate text-sm font-semibold">{data.label}</p></div>
      </div>
      {data.type === "condition" ? <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><span className="text-emerald-300">SIM</span><span className="text-red-300">NÃO</span></div> : null}
      {data.type === "action" ? <p className="mt-2 truncate text-xs text-[#9CA3AF]">{String(data.config.actionType || "Ação interna")}</p> : null}
      <p className="mt-3 min-h-8 text-xs leading-4 text-[#A9B0B8]">{summary}</p>
      {incomplete ? <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#FFD21F]"><Settings2 className="h-3.5 w-3.5" />Configuração necessária</p> : null}
      {data.type === "trigger" || data.type === "action" || data.type === "wait" ? <Handle type="source" position={Position.Right} id="output" className="!h-4 !w-4 !border-2 !border-[#0A0A0A] !bg-[#B7FF3C] opacity-70 transition group-hover:opacity-100" /> : null}
      {data.type === "condition" ? <><span className="absolute -right-12 top-[34%] text-[10px] font-semibold text-emerald-300">SIM</span><Handle type="source" position={Position.Right} id="yes" style={{ top: "36%" }} className="!h-4 !w-4 !border-2 !border-[#0A0A0A] !bg-[#6FD6B5] opacity-70 transition group-hover:opacity-100" /><span className="absolute -right-12 top-[68%] text-[10px] font-semibold text-red-300">NÃO</span><Handle type="source" position={Position.Right} id="no" style={{ top: "70%" }} className="!h-4 !w-4 !border-2 !border-[#0A0A0A] !bg-[#DC3035] opacity-70 transition group-hover:opacity-100" /></> : null}
    </div>
  );
}

function FreeformAutomationBuilder(props: {
  automationId: number;
  triggerType: string;
  title?: string;
  onBack?: () => void;
  draft?: AutomationVersion;
  active?: AutomationVersion;
  onSaved: () => Promise<void>;
  onPublish?: (definition?: AutomationDefinition, versionId?: number) => Promise<void>;
  readOnly?: boolean;
}) {
  const definition = props.draft?.definition || props.active?.definition || { schemaVersion: 1 as const, trigger: { type: props.triggerType, config: {} }, steps: [] };
  const initial = useMemo(() => flowDefinition(definition), [definition]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [labels, setLabels] = useState<Array<{ id: number; name: string; color: string }>>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const history = useRef<Array<{ nodes: FlowNode[]; edges: Edge[] }>>([]);
  const future = useRef<Array<{ nodes: FlowNode[]; edges: Edge[] }>>([]);
  const { screenToFlowPosition, fitView } = useReactFlow();

  useEffect(() => {
    void Promise.all([commercialEntitiesAPI.getPipelines(), commercialEntitiesAPI.getLabels(), commercialEntitiesAPI.getUsers()]).then(([pipelineData, labelData, userData]) => {
      setPipelines(pipelineData.pipelines); setStages(pipelineData.stages); setLabels(labelData.labels); setUsers(userData.users);
    }).catch(() => undefined);
  }, []);
  const selected = nodes.find((node) => node.id === selectedId);
  const requestBack = () => { if (dirty && !window.confirm("Você possui alterações não salvas. Deseja sair mesmo assim?")) return; props.onBack?.(); };
  const remember = () => { history.current = [...history.current.slice(-39), { nodes, edges }]; future.current = []; setDirty(true); };
  const undo = () => { const previous = history.current.pop(); if (!previous) return; future.current.push({ nodes, edges }); setNodes(previous.nodes); setEdges(previous.edges); setSelectedId(null); setSelectedEdgeId(null); };
  const redo = () => { const next = future.current.pop(); if (!next) return; history.current.push({ nodes, edges }); setNodes(next.nodes); setEdges(next.edges); };
  const updateSelected = (patch: Partial<BuilderNode>) => { setDirty(true); setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node)); };
  const updateConfig = (key: string, value: unknown) => updateSelected({ config: { ...(selected?.data.config || {}), [key]: value }, label: key === "actionType" ? ACTION_CATALOG.find((item) => item.id === String(value))?.name || "Executar ação" : selected?.data.label });
  const validConnection = (connection: Connection, ignoredEdgeId?: string) => {
    if (!connection.source || !connection.target || connection.source === connection.target || connection.target === "trigger_1") return false;
    const existingEdges = ignoredEdgeId ? edges.filter((edge) => edge.id !== ignoredEdgeId) : edges;
    if (existingEdges.some((edge) => edge.source === connection.source && edge.target === connection.target && edge.sourceHandle === connection.sourceHandle)) return false;
    const graph = new Map<string, string[]>();
    existingEdges.concat({ id: "candidate", source: connection.source, target: connection.target }).forEach((edge) => graph.set(edge.source, [...(graph.get(edge.source) || []), edge.target]));
    const seen = new Set<string>(); const visit = (id: string): boolean => { if (id === connection.source) return true; if (seen.has(id)) return false; seen.add(id); return (graph.get(id) || []).some(visit); };
    return !visit(connection.target);
  };
  const onConnect = (connection: Connection) => { if (!props.readOnly && validConnection(connection)) { remember(); setEdges((current) => addEdge({ ...connection, id: `${connection.source}-${connection.sourceHandle || "next"}-${connection.target}`, type: "smoothstep", style: { cursor: "pointer" }, data: { branch: connection.sourceHandle } }, current)); } else if (!props.readOnly) toast.error("Conexão inválida ou ciclo não suportado."); };
  const onReconnect = (oldEdge: Edge, connection: Connection) => { const wasValid = validConnection(connection, oldEdge.id); if (!props.readOnly && wasValid) { remember(); setEdges((current) => reconnectEdge(oldEdge, connection, current)); } else if (!props.readOnly) toast.error("Reconexão inválida ou ciclo não suportado."); };
  const handleEdgesChange = (changes: Parameters<typeof onEdgesChange>[0]) => { if (changes.some((change) => change.type === "remove") && !props.readOnly) remember(); onEdgesChange(changes); };
  const addNodeAt = (kind: string, position: { x: number; y: number }, actionId?: string) => {
    if (props.readOnly) return;
    const type = kind === "trigger" ? "trigger" : kind === "condition" ? "condition" : kind === "wait" ? "wait" : "action";
    if (type === "trigger" && nodes.some((node) => node.data.type === "trigger")) { toast.error("Esta automação já possui um gatilho."); return; }
    const id = `${type}_${Date.now()}`; const config = type === "trigger" ? { triggerType: actionId || props.triggerType } : actionId ? { ...defaultConfig("action"), actionType: actionId } : defaultConfig(type);
    remember(); setDirty(true); setNodes((current) => current.concat({ id, type: "kaizen", position, data: { id, type, label: type === "trigger" ? triggers[String(config.triggerType)] || String(config.triggerType) : actionId ? ACTION_CATALOG.find((item) => item.id === actionId)?.name || "Executar ação" : nodeMeta[type].title, config, x: position.x, y: position.y } }));
    setSelectedId(id);
  };
  const addTool = (kind: string, actionId?: string) => addNodeAt(kind, screenToFlowPosition({ x: 500, y: 280 }), actionId);
  const onDrop = (event: React.DragEvent) => { event.preventDefault(); const kind = event.dataTransfer.getData("application/kaizen-node"); const actionId = event.dataTransfer.getData("application/kaizen-action"); if (kind) addNodeAt(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }), actionId || undefined); };
  const disconnectSelected = () => { if (!selectedId || props.readOnly) return; remember(); setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId)); };
  const deleteSelected = () => { if (props.readOnly) return; if (selectedEdgeId) { remember(); setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId)); setSelectedEdgeId(null); return; } if (!selectedId) return; remember(); setNodes((current) => current.filter((node) => node.id !== selectedId)); setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId)); setSelectedId(null); };
  const duplicateSelected = () => { if (!selected || props.readOnly || selected.data.type === "trigger") return; remember(); const id = `${selected.data.type}_${Date.now()}`; setNodes((current) => current.concat({ ...selected, id, position: { x: selected.position.x + 40, y: selected.position.y + 40 }, data: { ...selected.data, id, x: selected.position.x + 40, y: selected.position.y + 40 } })); setSelectedId(id); };
  const organize = () => { if (props.readOnly) return; remember(); setNodes((current) => current.map((node, index) => ({ ...node, position: { x: 80 + (index % 4) * 300, y: 160 + Math.floor(index / 4) * 190 }, data: { ...node.data, x: 80 + (index % 4) * 300, y: 160 + Math.floor(index / 4) * 190 } }))); };
  const currentDefinition = () => definitionFromFlow(nodes, edges, props.triggerType);
  const save = async (notify = true) => { setSaving(true); try { const latest = currentDefinition(); if (props.draft) await automationsAPI.updateVersion(props.automationId, props.draft.id, latest); else await automationsAPI.createVersion(props.automationId, latest); setDirty(false); if (notify) toast.success("Rascunho salvo."); await props.onSaved(); return true; } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o rascunho."); return false; } finally { setSaving(false); } };
  const publishCurrent = async () => { if (!props.onPublish) return; setSaving(true); try { const latest = currentDefinition(); let versionId = props.draft?.id; if (versionId) await automationsAPI.updateVersion(props.automationId, versionId, latest); else versionId = (await automationsAPI.createVersion(props.automationId, latest)).id; setDirty(false); await props.onPublish(latest, versionId); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível publicar o fluxo."); } finally { setSaving(false); } };
  useEffect(() => { const onKey = (event: KeyboardEvent) => { const target = event.target as HTMLElement; if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; } if ((event.key === "Delete" || event.key === "Backspace") && (selectedId || selectedEdgeId)) { event.preventDefault(); deleteSelected(); } if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void save(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); });
  useEffect(() => { const onBeforeUnload = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", onBeforeUnload); return () => window.removeEventListener("beforeunload", onBeforeUnload); }, [dirty]);
  const matches = ACTION_CATALOG.filter((item) => [item.name, item.description, item.category, ...item.aliases].join(" ").toLowerCase().includes(search.toLowerCase()));
  const testFlow = async () => {
    const leadId = Number(window.prompt("Informe o ID do Lead para o teste real:"));
    if (!Number.isSafeInteger(leadId) || leadId <= 0) return;
    try {
      const result = await automationsAPI.dryRun(props.automationId, leadId, currentDefinition());
      toast.success(`Teste concluído: ${result.steps.length} etapas avaliadas.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível testar o fluxo.");
    }
  };
  const toolButton = (label: string, kind: string, actionId?: string) => <button type="button" draggable onDragStart={(event) => { event.dataTransfer.setData("application/kaizen-node", kind); if (actionId) event.dataTransfer.setData("application/kaizen-action", actionId); }} onClick={() => addTool(kind, actionId)} className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-[#0A0A0A]/60 px-2.5 py-2 text-left text-xs transition hover:border-[#B7FF3C]/70 hover:bg-[#B7FF3C]/10"><span className="rounded bg-[#181A1F] p-1 text-[#B7FF3C]">{kind === "condition" ? <GitBranch className="h-3.5 w-3.5" /> : kind === "wait" ? <Clock3 className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1 truncate">{label}</span><span className="text-[10px] text-[#7E8792]">{kind === "action" ? "ação" : kind}</span></button>;
  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0A0A0A]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#181A1F] px-4 py-3"><div className="flex min-w-0 items-center gap-3">{props.onBack ? <Button size="sm" variant="ghost" title="Voltar para automações" onClick={requestBack}><ChevronLeft className="mr-1 h-4 w-4" />Automações</Button> : null}<div className="min-w-0 border-l border-white/10 pl-3"><p className="truncate text-sm font-semibold">{props.title || "Automação"}</p><span className="text-[11px] text-[#9CA3AF]">{props.draft ? (dirty ? "Alterações não salvas" : "Salvo") : "Somente leitura"}</span></div><Badge variant="outline" className="border-[#B7FF3C]/60 text-[#B7FF3C]">{props.draft ? (dirty ? "Alterações não salvas" : "Rascunho") : "Somente leitura"}</Badge></div><div className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => void testFlow()} disabled={props.readOnly}><Check className="mr-1 h-4 w-4" />Testar</Button><Button size="sm" variant="ghost" onClick={organize} disabled={props.readOnly}><LayoutDashboard className="mr-1 h-4 w-4" />Organizar</Button><Button size="sm" variant="ghost" onClick={() => void save()} disabled={props.readOnly || saving}><Save className="mr-1 h-4 w-4" />{saving ? "Salvando..." : "Salvar"}</Button>{props.onPublish ? <Button size="sm" onClick={() => void publishCurrent()} disabled={props.readOnly || saving}>Publicar</Button> : null}</div></div>
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row-reverse"><aside className="w-full shrink-0 border-b border-white/10 bg-[#181A1F] lg:w-[290px] lg:border-b-0 lg:border-l"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="text-sm font-semibold">{selected ? "Configuração do node" : "Ações"}</span>{selected ? <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>Voltar</Button> : null}</div>{selected ? <div className="max-h-[630px] overflow-y-auto p-4"><NodeInspector node={selected.data} updateConfig={updateConfig} updateNode={updateSelected} triggers={triggers} actions={actions} labels={labels} users={users} pipelines={pipelines} stages={stages} /><div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={duplicateSelected}>Duplicar</Button><Button size="sm" variant="outline" onClick={disconnectSelected}>Desconectar</Button><Button size="sm" variant="ghost" onClick={deleteSelected}>Excluir</Button></div></div> : <div className="max-h-[630px] overflow-y-auto p-3"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ação..." className="mb-3" /><details open><summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-wide text-[#B7FF3C]">Gatilhos</summary><div className="space-y-1">{Object.entries(triggers).map(([id, label]) => toolButton(label, "trigger", id))}</div></details><details open className="mt-4"><summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-wide text-[#B7FF3C]">Lógica</summary><div className="space-y-1">{toolButton("Condição", "condition")}{toolButton("Aguardar", "wait")}</div></details><details open className="mt-4"><summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-wide text-[#B7FF3C]">Ações</summary><div className="space-y-1">{matches.map((item) => toolButton(item.name, "action", item.id))}</div></details></div>}</aside><main className="relative min-h-[620px] min-w-0 flex-1 bg-[#0E1013]" onDrop={onDrop} onDragOver={(event) => event.preventDefault()}><ReactFlow nodes={nodes} edges={edges} nodeTypes={flowNodeTypes} onNodesChange={onNodesChange} onEdgesChange={handleEdgesChange} onConnect={onConnect} onReconnect={onReconnect} onNodeClick={(_event, node) => { setSelectedId(node.id); setSelectedEdgeId(null); }} onEdgeClick={(_event, edge) => { if (props.readOnly) return; remember(); setEdges((current) => current.filter((item) => item.id !== edge.id)); setSelectedEdgeId(null); setSelectedId(null); }} onPaneClick={() => { setSelectedId(null); setSelectedEdgeId(null); }} onNodeDragStart={() => remember()} fitView deleteKeyCode={null} nodesDraggable={!props.readOnly} nodesConnectable={!props.readOnly} edgesFocusable><Background color="#2A2D33" gap={24} size={1} /><Controls className="!border-white/10 !bg-[#181A1F]" /><MiniMap pannable zoomable className="!bg-[#181A1F]" nodeColor={(node) => node.data.type === "condition" ? "#A63DA5" : node.data.type === "trigger" ? "#B7FF3C" : "#4D6EDB"} /></ReactFlow>{!nodes.length ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="text-center"><p className="text-lg font-semibold text-[#F4F5F7]">Canvas vazio</p><p className="mt-1 text-sm text-[#9CA3AF]">Arraste um bloco da biblioteca para começar.</p></div></div> : null}<div className="absolute left-3 top-3 z-10 flex gap-1 rounded-md border border-white/10 bg-[#181A1F]/90 p-1"><Button size="icon" variant="ghost" title="Ajustar visão" onClick={() => fitView({ padding: 0.2 })}><Square className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Organizar nós" onClick={organize}><LayoutDashboard className="h-4 w-4" /></Button></div></main></div>
  </div>;
}

export function AutomationBuilder(props: React.ComponentProps<typeof FreeformAutomationBuilder>) {
  return <ReactFlowProvider><FreeformAutomationBuilder {...props} /></ReactFlowProvider>;
}

function LegacyAutomationBuilder({
  automationId,
  triggerType,
  draft,
  active,
  onSaved,
  onPublish,
  readOnly = false,
}: {
  automationId: number;
  triggerType: string;
  draft?: AutomationVersion;
  active?: AutomationVersion;
  onSaved: () => Promise<void>;
  onPublish?: () => Promise<void>;
  readOnly?: boolean;
}) {
  const [nodes, setNodes] = useState<BuilderNode[]>(() =>
    definitionToBuilder(
      draft?.definition ||
        active?.definition || {
          schemaVersion: 1,
          trigger: { type: triggerType, config: {} },
          steps: [],
        },
    ),
  );
  const [selectedId, setSelectedId] = useState("trigger_1");
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [labels, setLabels] = useState<
    Array<{ id: number; name: string; color: string }>
  >([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerAfter, setPickerAfter] = useState("trigger_1");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const canvasDragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    void Promise.all([
      commercialEntitiesAPI.getPipelines(),
      commercialEntitiesAPI.getLabels(),
      commercialEntitiesAPI.getUsers(),
    ])
      .then(([pipelineData, labelData, userData]) => {
        setPipelines(pipelineData.pipelines);
        setStages(pipelineData.stages);
        setLabels(labelData.labels);
        setUsers(userData.users);
      })
      .catch(() => undefined);
  }, []);
  const selected = nodes.find((node) => node.id === selectedId) || nodes[0];
  const edges = useMemo(
    () =>
      nodes
        .flatMap((node) =>
          node.type === "condition"
            ? [...(["yes", "no"] as const)].map((branch) => ({
                from: node,
                to: nextOf(node, branch),
                branch,
              }))
            : [{ from: node, to: nextOf(node), branch: undefined }],
        )
        .filter((edge) => edge.to),
    [nodes],
  );

  const updateNode = (patch: Partial<BuilderNode>) =>
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedId ? { ...node, ...patch } : node,
      ),
    );
  const updateConfig = (key: string, value: unknown) =>
    updateNode({
      config: { ...(selected?.config || {}), [key]: value },
      label:
        selected?.type === "action" && key === "actionType"
          ? ACTION_CATALOG.find((item) => item.id === String(value))?.name || actions[String(value)] || "Executar acao"
          : selected?.label,
    });
  const addNode = (
    type: BuilderType,
    afterId = selectedId,
    actionId?: string,
  ) => {
    const id = `${type}_${Date.now()}`;
    setNodes((current) => {
      const source = current.find((node) => node.id === afterId);
      const target =
        source?.type === "condition" ? source.branches?.yes : source?.next;
      const created = {
        id,
        type,
        label: actionId ? ACTION_CATALOG.find((item) => item.id === actionId)?.name || nodeMeta[type].title : nodeMeta[type].title,
        config: actionId
          ? { ...defaultConfig(type), actionType: actionId }
          : defaultConfig(type),
        x: (source?.x || 100) + 300,
        y: source?.y || 210,
        next: target || null,
        branches:
          type === "condition" ? { yes: target || null, no: null } : undefined,
      };
      return current
        .map((node) =>
          node.id === afterId
            ? source?.type === "condition"
              ? { ...node, branches: { ...node.branches, yes: id } }
              : { ...node, next: id }
            : node,
        )
        .concat(created);
    });
    setSelectedId(id);
    setDrawerOpen(true);
  };
  const openActionPicker = (afterId: string) => {
    setPickerAfter(afterId);
    setPickerQuery("");
    setPickerOpen(true);
  };
  const chooseAction = (item: ActionCatalogItem) => {
    if (item.id === "wait.period") addNode("wait", pickerAfter);
    else if (
      [
        "lead.update_status",
        "lead.assign_user",
        "lead.remove_assignee",
        "lead.update_field",
        "lead.add_note",
        "lead.move_pipeline",
        "activity.create_task",
        "activity.create_call",
        "activity.create_follow_up",
        "activity.complete",
        "notification.create",
      ].includes(item.id)
    )
      addNode("action", pickerAfter, item.id);
    else if (
      item.id === "lead.add_tag" ||
      item.id === "lead.remove_tag" ||
      item.id === "lead.move_pipeline_stage" ||
      item.id === "activity.create"
    )
      addNode("action", pickerAfter, item.id);
    else addNode("action", pickerAfter, item.id);
    setPickerOpen(false);
  };
  const removeSelected = () => {
    if (!selected || selected.type === "trigger" || selected.type === "finish")
      return;
    setNodes((current) =>
      current
        .filter((node) => node.id !== selected.id)
        .map((node) => ({
          ...node,
          next: node.next === selected.id ? selected.next || null : node.next,
          branches: node.branches
            ? {
                yes:
                  node.branches.yes === selected.id ? null : node.branches.yes,
                no: node.branches.no === selected.id ? null : node.branches.no,
              }
            : undefined,
        })),
    );
    setSelectedId("trigger_1");
  };
  const duplicateSelected = () => {
    if (!selected || selected.type === "trigger") return;
    const id = `${selected.type}_${Date.now()}`;
    setNodes((current) =>
      current.concat({
        ...selected,
        id,
        x: selected.x + 40,
        y: selected.y + 40,
        next: null,
      }),
    );
    setSelectedId(id);
  };
  const save = async () => {
    if (!draft) {
      toast.error("Crie um rascunho antes de salvar o fluxo.");
      return;
    }
    setSaving(true);
    try {
      await automationsAPI.updateVersion(
        automationId,
        draft.id,
        builderToDefinition(nodes, triggerType),
      );
      toast.success("Rascunho salvo.");
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o rascunho.",
      );
    } finally {
      setSaving(false);
    }
  };
  const autoLayout = () =>
    setNodes((current) =>
      current.map((node, index) => ({
        ...node,
        x: 70 + index * 285,
        y: node.type === "condition" ? 210 : 210,
      })),
    );
  const onPointerDown = (event: React.PointerEvent, node: BuilderNode) => {
    if (readOnly) return;
    event.stopPropagation();
    dragRef.current = {
      id: node.id,
      dx: event.clientX - node.x * zoom - pan.x,
      dy: event.clientY - node.y * zoom - pan.y,
    };
    setSelectedId(node.id);
    setDrawerOpen(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (canvasDragRef.current) {
      const drag = canvasDragRef.current;
      setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y });
      return;
    }
    if (!dragRef.current) return;
    const drag = dragRef.current;
    setNodes((current) =>
      current.map((node) =>
        node.id === drag.id
          ? {
              ...node,
              x: Math.max(20, (event.clientX - pan.x - drag.dx) / zoom),
              y: Math.max(20, (event.clientY - pan.y - drag.dy) / zoom),
            }
          : node,
      ),
    );
  };
  const stopDrag = () => {
    dragRef.current = null;
    canvasDragRef.current = null;
  };
  const onCanvasPointerDown = (event: React.PointerEvent) => {
    if (readOnly || event.target !== event.currentTarget) return;
    canvasDragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  };
  const fitView = () => {
    setZoom(Math.min(0.9, 900 / Math.max(900, nodes.length * 285)));
    setPan({ x: 32, y: 105 });
  };
  const testFlow = async () => {
    const definition = builderToDefinition(nodes, triggerType);
    const leadId = Number(window.prompt("Informe o ID do Lead para o dry-run:"));
    if (!Number.isSafeInteger(leadId) || leadId <= 0) return;
    try {
      const result = await automationsAPI.dryRun(automationId, leadId, definition);
      toast.success(`Dry-run concluido: ${result.steps.length} etapas avaliadas, sem gravacoes.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel testar o fluxo.");
    }
    /*
      `Fluxo válido para pré-visualização: ${definition.steps.length} etapas, ${actionsInFlow} ações.`,
    ); */
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#0d0f12]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/50 text-primary">
            <Sparkles className="mr-1 h-3 w-3" />
            Construtor visual
          </Badge>
          <span className="text-xs text-muted-foreground">
            Definicao semantica v1
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={testFlow}
            title="Validar fluxo"
          >
            <Check className="mr-1 h-4 w-4" />
            Testar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Organizar automaticamente"
            onClick={autoLayout}
          >
            <LayoutDashboard className="mr-1 h-4 w-4" />
            Organizar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Diminuir zoom"
            onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-10 text-center text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            title="Aumentar zoom"
            onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={readOnly || saving}
          >
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Salvando" : "Salvar rascunho"}
          </Button>
          {onPublish ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onPublish()}
              disabled={readOnly}
            >
              Publicar
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-[620px] flex-col lg:flex-row">
        <div
          className="relative min-h-[520px] flex-1 overflow-hidden bg-[radial-gradient(#2a2d33_1px,transparent_1px)] [background-size:24px_24px]"
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerLeave={stopDrag}
        >
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1 rounded-md border border-border bg-card/90 p-1">
            <Button size="icon" variant="ghost" title="Mover tela">
              <Move className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Ajustar fluxo"
              onClick={fitView}
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Menos zoom"
              onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Mais zoom"
              onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="kaizen-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="#8a939f" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const to = nodes.find((node) => node.id === edge.to);
              if (!to) return null;
              const x1 = pan.x + (edge.from.x + 210) * zoom;
              const y1 = pan.y + (edge.from.y + 55) * zoom;
              const x2 = pan.x + to.x * zoom;
              const y2 = pan.y + (to.y + 55) * zoom;
              return (
                <g key={`${edge.from.id}-${edge.branch || "next"}`}>
                  <path
                    d={`M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={
                      edge.branch === "yes"
                        ? "#6fd6b5"
                        : edge.branch === "no"
                          ? "#dc5860"
                          : "#7f8995"
                    }
                    strokeWidth="2"
                    markerEnd="url(#kaizen-arrow)"
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 8}
                    fill="#9ca5af"
                    fontSize="11"
                  >
                    {edge.branch || ""}
                  </text>
                </g>
              );
            })}
          </svg>
          {edges.map((edge) => {
            const to = nodes.find((node) => node.id === edge.to);
            if (!to) return null;
            return (
              <button
                key={`insert-${edge.from.id}-${edge.branch || "next"}`}
                type="button"
                title="Adicionar etapa"
                className="absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
                style={{
                  left: pan.x + ((edge.from.x + 210 + to.x) / 2) * zoom,
                  top: pan.y + ((edge.from.y + to.y) / 2 + 55) * zoom,
                }}
                onClick={() => openActionPicker(edge.from.id)}
              >
                <Plus className="h-3 w-3" />
              </button>
            );
          })}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {nodes.map((node) => {
              const meta = nodeMeta[node.type];
              const Icon = meta.icon;
              return (
                <div
                  key={node.id}
                  className={`absolute w-[210px] cursor-pointer select-none rounded-lg border p-3 shadow-xl transition ${meta.color} ${selectedId === node.id ? "ring-2 ring-primary" : ""}`}
                  style={{ left: node.x, top: node.y }}
                  onPointerDown={(event) => onPointerDown(event, node)}
                >
                  <div className="flex items-start gap-2">
                    <div className="rounded-md bg-background/60 p-1.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {meta.title}
                      </p>
                      <p className="truncate text-sm font-medium">
                        {node.label}
                      </p>
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {node.type === "condition" ? (
                    <div className="mt-3 grid grid-cols-2 gap-1 text-[10px]">
                      <span className="rounded bg-emerald-400/15 px-2 py-1 text-emerald-300">
                        SIM
                      </span>
                      <span className="rounded bg-red-400/15 px-2 py-1 text-red-300">
                        NAO
                      </span>
                    </div>
                  ) : null}
                  {node.type === "action" ? (
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      {actions[String(node.config.actionType)] || "Acao"}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 h-20 w-28 rounded-md border border-border bg-card/85 p-2 shadow-lg" aria-label="Minimapa do fluxo">
            <div className="relative h-full w-full">
              {nodes.map((node) => <span key={`map-${node.id}`} className={`absolute h-1.5 w-3 rounded-sm ${node.type === "condition" ? "bg-violet-300" : node.type === "action" ? "bg-sky-300" : node.type === "finish" ? "bg-emerald-300" : "bg-primary"}`} style={{ left: `${Math.min(92, node.x / 12)}%`, top: `${Math.min(88, node.y / 5)}%` }} />)}
            </div>
          </div>
        </div>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="w-full overflow-y-auto border-border bg-card sm:max-w-[380px]">
            <SheetHeader className="mb-5">
              <SheetTitle>Configurar etapa</SheetTitle>
              <SheetDescription>
                As configurações ficam fora do node para manter o canvas limpo.
              </SheetDescription>
            </SheetHeader>
            {selected ? (
              <NodeInspector
                node={selected}
                updateConfig={updateConfig}
                updateNode={updateNode}
                triggers={triggers}
                actions={actions}
                labels={labels}
                users={users}
                pipelines={pipelines}
                stages={stages}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um bloco para configurar.
              </p>
            )}
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adicionar bloco
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  ["condition", "wait", "action", "finish"] as BuilderType[]
                ).map((type) => {
                  const Icon = nodeMeta[type].icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      disabled={readOnly}
                      onClick={() =>
                        type === "action"
                          ? openActionPicker(selectedId)
                          : addNode(type)
                      }
                    >
                      <Icon className="mr-1 h-3.5 w-3.5" />
                      {nodeMeta[type].title}
                    </Button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={readOnly || selected?.type === "trigger"}
                  onClick={duplicateSelected}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Duplicar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={
                    readOnly ||
                    selected?.type === "trigger" ||
                    selected?.type === "finish"
                  }
                  onClick={removeSelected}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Excluir
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <ActionPicker
          open={pickerOpen}
          query={pickerQuery}
          onQueryChange={setPickerQuery}
          onOpenChange={setPickerOpen}
          onChoose={chooseAction}
        />
      </div>
    </div>
  );
}

function ActionPicker({
  open,
  query,
  onQueryChange,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onChoose: (item: ActionCatalogItem) => void;
}) {
  const normalized = query.trim().toLowerCase();
  const matches = ACTION_CATALOG.filter((item) =>
    [item.name, item.description, item.category, ...item.aliases]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
  const grouped = matches.reduce<Record<string, ActionCatalogItem[]>>(
    (result, item) => {
      (result[item.category] ||= []).push(item);
      return result;
    },
    {},
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-2xl overflow-hidden border-border bg-card">
        <DialogHeader>
          <DialogTitle>Adicionar etapa</DialogTitle>
          <DialogDescription>
            Busque por nome, categoria ou sinônimo. A disponibilidade indica o
            que pode ser executado.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Buscar ação, por exemplo: whats, responsável ou esperar"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ||
                  category}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((item) => {
                  const Icon = item.icon;
                  const disabled =
                    item.availability !== "available" &&
                    item.availability !== "coming_soon";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChoose(item)}
                      className="flex items-start gap-3 rounded-md border border-border bg-background/40 p-3 text-left transition hover:border-primary/60 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <span className="rounded-md bg-muted p-2">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {item.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                        <Badge
                          variant="outline"
                          className={`mt-2 text-[10px] ${item.availability === "requires_integration" ? "border-amber-400/50 text-amber-300" : item.availability === "coming_soon" ? "border-muted-foreground/40 text-muted-foreground" : "border-primary/50 text-primary"}`}
                        >
                          {AVAILABILITY_LABELS[item.availability]}
                          {item.requiredIntegration
                            ? ` · ${item.requiredIntegration}`
                            : ""}
                        </Badge>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {matches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma ação encontrada.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NodeInspector({
  node,
  updateConfig,
  updateNode,
  triggers,
  actions,
  labels,
  users,
  pipelines,
  stages,
}: {
  node: BuilderNode;
  updateConfig: (key: string, value: unknown) => void;
  updateNode: (patch: Partial<BuilderNode>) => void;
  triggers: Record<string, string>;
  actions: Record<string, string>;
  labels: Array<{ id: number; name: string; color: string }>;
  users: UserOption[];
  pipelines: PipelineDefinition[];
  stages: PipelineStage[];
}) {
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccount[]>([]);
  const actionType = String(node.config.actionType || "lead.add_tag");
  useEffect(() => {
    if (actionType !== "whatsapp.send") return;
    void whatsappAPI.listAccounts().then((result) => setWhatsappAccounts(result.accounts.filter((account) => account.status === "connected"))).catch(() => setWhatsappAccounts([]));
  }, [actionType]);
  if (node.type === "trigger")
    return (
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Gatilho
        </h3>
        <FieldLabel label="Evento">
          <Select
            value={String(node.config.triggerType || "lead.created")}
            onValueChange={(value) => updateConfig("triggerType", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(triggers).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldLabel>
        <p className="text-xs text-muted-foreground">
          O evento e persistido e avaliado pela engine de automacoes.
        </p>
      </div>
    );
  if (node.type === "finish")
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Finalizar fluxo</h3>
        <p className="text-xs text-muted-foreground">
          Este bloco encerra o caminho sem executar nenhuma acao externa.
        </p>
      </div>
    );
  if (node.type === "wait")
    return (
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="h-4 w-4 text-amber-300" />
          Aguardar
        </h3>
        <FieldLabel label="Quantidade">
          <Input
            type="number"
            min="1"
            value={String(node.config.amount || 1)}
            onChange={(event) =>
              updateConfig("amount", Number(event.target.value))
            }
          />
        </FieldLabel>
        <FieldLabel label="Unidade">
          <Select
            value={String(node.config.unit || "hours")}
            onValueChange={(value) => updateConfig("unit", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
            </SelectContent>
          </Select>
        </FieldLabel>
      </div>
    );
  if (node.type === "condition")
    return (
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="h-4 w-4 text-violet-300" />
          Condicao
        </h3>
        <FieldLabel label="Campo">
          <Select
            value={String(node.config.field || "status")}
            onValueChange={(value) => updateConfig("field", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "status",
                "pipeline_stage",
                "label",
                "assigned_user",
                "source",
                "email",
                "phone",
                "website",
              ].map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldLabel>
        <FieldLabel label="Operador">
          <Select
            value={String(node.config.operator || "equals")}
            onValueChange={(value) => updateConfig("operator", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">E igual a</SelectItem>
              <SelectItem value="not_equals">E diferente de</SelectItem>
              <SelectItem value="contains">Contem</SelectItem>
              <SelectItem value="is_empty">Esta vazio</SelectItem>
            </SelectContent>
          </Select>
        </FieldLabel>
        <FieldLabel label="Valor">
          <Input
            value={String(node.config.value || "")}
            onChange={(event) => updateConfig("value", event.target.value)}
          />
        </FieldLabel>
      </div>
    );
  const selectedAction = ACTION_CATALOG.find((item) => item.id === actionType);
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Activity className="h-4 w-4 text-sky-300" />
        Acao interna
      </h3>
      <FieldLabel label="Acao">
        <Select
          value={actionType}
          onValueChange={(value) => updateConfig("actionType", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_CATALOG.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldLabel>
      {selectedAction?.availability !== "available" ? (
        <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-200">
          {AVAILABILITY_LABELS[selectedAction?.availability || "coming_soon"]}
          {selectedAction?.requiredIntegration
            ? `: ${selectedAction.requiredIntegration}`
            : ""}
          . Esta etapa pode ser preparada no rascunho, mas a publicação será
          bloqueada enquanto não houver executor seguro.
        </p>
      ) : null}
      {actionType === "lead.update_status" ? <FieldLabel label="Novo status"><Input value={String(node.config.status || "")} onChange={(event) => updateConfig("status", event.target.value)} placeholder="Ex.: Qualificado" /></FieldLabel> : null}
      {actionType === "lead.update_field" ? <><FieldLabel label="Campo permitido"><Select value={String(node.config.field || "")} onValueChange={(value) => updateConfig("field", value)}><SelectTrigger><SelectValue placeholder="Selecione um campo" /></SelectTrigger><SelectContent>{["business_name", "category", "address", "city", "state", "phone", "email", "website"].map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}</SelectContent></Select></FieldLabel><FieldLabel label="Valor"><Input value={String(node.config.value || "")} onChange={(event) => updateConfig("value", event.target.value)} /></FieldLabel></> : null}
      {actionType === "lead.add_note" ? <FieldLabel label="Observação"><Textarea value={String(node.config.note || "")} onChange={(event) => updateConfig("note", event.target.value)} /></FieldLabel> : null}
      {["lead.add_tag", "lead.remove_tag"].includes(actionType) ? (
        <FieldLabel label="Etiqueta">
          <Select
            value={String(node.config.labelId || "")}
            onValueChange={(value) => updateConfig("labelId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma etiqueta" />
            </SelectTrigger>
            <SelectContent>
              {labels.map((label) => (
                <SelectItem key={label.id} value={String(label.id)}>
                  {label.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldLabel>
      ) : null}
      {actionType === "lead.assign_user" ? (
        <FieldLabel label="Responsavel">
          <Select
            value={String(node.config.userId || "")}
            onValueChange={(value) => updateConfig("userId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um usuario" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldLabel>
      ) : null}
      {actionType === "lead.move_pipeline_stage" ? (
        <FieldLabel label="Etapa">
          <Select
            value={String(node.config.stageId || "")}
            onValueChange={(value) => updateConfig("stageId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma etapa" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((pipeline) => (
                <optgroup key={pipeline.id} label={pipeline.name}>
                  {stages
                    .filter((stage) => stage.pipeline_id === pipeline.id)
                    .map((stage) => (
                      <SelectItem key={stage.id} value={String(stage.id)}>
                        {stage.name}
                      </SelectItem>
                    ))}
                </optgroup>
              ))}
            </SelectContent>
          </Select>
        </FieldLabel>
      ) : null}
      {["activity.create", "activity.create_task", "activity.create_call", "activity.create_follow_up"].includes(actionType) ? (
        <>
          <FieldLabel label="Titulo">
            <Input
              value={String(node.config.title || "")}
              onChange={(event) => updateConfig("title", event.target.value)}
            />
          </FieldLabel>
          <FieldLabel label="Descricao">
            <Textarea
              value={String(node.config.description || "")}
              onChange={(event) =>
                updateConfig("description", event.target.value)
              }
            />
          </FieldLabel>
        </>
      ) : null}
      {actionType === "activity.complete" ? <FieldLabel label="ID da atividade"><Input type="number" min="1" value={String(node.config.activityId || "")} onChange={(event) => updateConfig("activityId", Number(event.target.value))} /></FieldLabel> : null}
      {actionType === "email.send" ? <><FieldLabel label="Destinatário"><Input value={String(node.config.recipient || "{{lead.email}}")} onChange={(event) => updateConfig("recipient", event.target.value)} /></FieldLabel><FieldLabel label="Assunto"><Input value={String(node.config.subject || "")} placeholder="Ex.: Olá, {{lead.name}}" onChange={(event) => updateConfig("subject", event.target.value)} /></FieldLabel></> : null}
      {actionType === "whatsapp.send" ? <><FieldLabel label="Conta WhatsApp"><Select value={String(node.config.accountId || "")} onValueChange={(value) => updateConfig("accountId", Number(value))}><SelectTrigger><SelectValue placeholder={whatsappAccounts.length ? "Selecione a conta" : "Nenhuma conta conectada"} /></SelectTrigger><SelectContent>{whatsappAccounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}{account.phoneNumber ? ` - ${account.phoneNumber}` : ""}</SelectItem>)}</SelectContent></Select></FieldLabel><FieldLabel label="Destinatário"><Input value={String(node.config.recipient || "{{lead.phone}}")} onChange={(event) => updateConfig("recipient", event.target.value)} /></FieldLabel></> : null}
      {actionType === "notification.create" ? <><FieldLabel label="Título"><Input value={String(node.config.title || "")} onChange={(event) => updateConfig("title", event.target.value)} /></FieldLabel><FieldLabel label="Mensagem"><Textarea value={String(node.config.message || "")} onChange={(event) => updateConfig("message", event.target.value)} /></FieldLabel></> : null}
      {[
        "email.send",
        "whatsapp.send_message",
        "whatsapp.send",
        "whatsapp.send_template",
        "instagram.send_direct",
      ].includes(actionType) ? (
        <FieldLabel label="Mensagem">
          <Textarea
            value={String(node.config.message || "")}
            placeholder="Use o seletor para inserir variáveis"
            onChange={(event) => updateConfig("message", event.target.value)}
          />
          <Select
            onValueChange={(value) =>
              updateConfig(
                "message",
                `${String(node.config.message || "")}${value}`,
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Inserir variável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="{{lead.name}}">Lead · Nome</SelectItem>
              <SelectItem value="{{lead.company}}">Lead · Empresa</SelectItem>
              <SelectItem value="{{lead.phone}}">Lead · Telefone</SelectItem>
              <SelectItem value="{{lead.email}}">Lead · E-mail</SelectItem>
              <SelectItem value="{{assignee.name}}">
                Responsável · Nome
              </SelectItem>
              <SelectItem value="{{pipeline.stage}}">
                Pipeline · Etapa
              </SelectItem>
            </SelectContent>
          </Select>
        </FieldLabel>
      ) : null}
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
