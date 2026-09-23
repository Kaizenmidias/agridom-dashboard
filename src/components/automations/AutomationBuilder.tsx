import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
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

export function AutomationBuilder({
  automationId,
  triggerType,
  draft,
  active,
  onSaved,
  readOnly = false,
}: {
  automationId: number;
  triggerType: string;
  draft?: AutomationVersion;
  active?: AutomationVersion;
  onSaved: () => Promise<void>;
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
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

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
          ? actions[String(value)] || "Executar acao"
          : selected?.label,
    });
  const addNode = (type: BuilderType, afterId = selectedId) => {
    const id = `${type}_${Date.now()}`;
    setNodes((current) => {
      const source = current.find((node) => node.id === afterId);
      const target =
        source?.type === "condition" ? source.branches?.yes : source?.next;
      const created = {
        id,
        type,
        label: nodeMeta[type].title,
        config: defaultConfig(type),
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
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
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
        </div>
      </div>
      <div className="flex min-h-[620px] flex-col lg:flex-row">
        <div
          className="relative min-h-[520px] flex-1 overflow-hidden bg-[radial-gradient(#2a2d33_1px,transparent_1px)] [background-size:24px_24px]"
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
              title="Centralizar"
              onClick={() => setPan({ x: 20, y: 20 })}
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
        </div>
        <aside className="w-full border-t border-border bg-card/70 p-4 lg:w-[310px] lg:border-l lg:border-t-0">
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
              {(["condition", "wait", "action", "finish"] as BuilderType[]).map(
                (type) => {
                  const Icon = nodeMeta[type].icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      disabled={readOnly}
                      onClick={() => addNode(type)}
                    >
                      <Icon className="mr-1 h-3.5 w-3.5" />
                      {nodeMeta[type].title}
                    </Button>
                  );
                },
              )}
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
        </aside>
      </div>
    </div>
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
  const actionType = String(node.config.actionType || "lead.add_tag");
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
            {Object.entries(actions).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldLabel>
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
      {actionType === "activity.create" ? (
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
