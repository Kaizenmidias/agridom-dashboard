import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Edit3,
  Eye,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AutomationBuilder } from "@/components/automations/AutomationBuilder";
import { useAuth } from "@/contexts/AuthContext";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import {
  automationsAPI,
  type AutomationDefinition,
  type AutomationDetail,
  type AutomationRun,
  type AutomationStatus,
  type AutomationSummary,
} from "@/services/automations";

const TRIGGER_LABELS: Record<string, string> = {
  "lead.created": "Lead criado",
  "lead.updated": "Lead atualizado",
  "lead.status_changed": "Status do Lead alterado",
  "lead.pipeline_stage_changed": "Etapa da Pipeline alterada",
  "lead.tag_added": "Etiqueta adicionada",
  "lead.tag_removed": "Etiqueta removida",
  "lead.assigned": "Responsável atribuído",
  "lead.converted": "Lead convertido",
  "activity.created": "Atividade criada",
  "activity.completed": "Atividade concluída",
};

const STATUS_LABELS: Record<AutomationStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  archived: "Arquivada",
};

const STATUS_CLASS: Record<AutomationStatus, string> = {
  draft: "border-slate-400/50 text-slate-300",
  active: "border-primary/50 text-primary",
  paused: "border-yellow-400/50 text-yellow-300",
  archived: "border-red-400/50 text-red-300",
};

const DEFAULT_DEFINITION = (trigger: string): AutomationDefinition => ({
  schemaVersion: 1,
  trigger: { type: trigger, config: {} },
  steps: [],
});

function formatDate(value?: string | null) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("pt-BR");
}

function statusBadge(status: AutomationStatus) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Workflow;
}) {
  return (
    <Card className="rounded-lg border shadow-none">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </CardContent>
    </Card>
  );
}

export function AutomationsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AutomationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("lead.created");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutomationSummary | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await automationsAPI.list();
      setItems(payload.automations);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar as automações.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.status === "active").length,
      paused: items.filter((item) => item.status === "paused").length,
      draft: items.filter((item) => item.status === "draft").length,
    }),
    [items],
  );

  const runAction = async (
    item: AutomationSummary,
    action: "pause" | "activate" | "archive",
  ) => {
    try {
      const response = await automationsAPI[action](item.id);
      setItems((current) => response.status === "archived" ? current.filter((entry) => entry.id !== item.id) : current.map((entry) => entry.id === item.id ? { ...entry, ...response } : entry));
      toast.success("Automação atualizada.");
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Não foi possível atualizar a automação.",
      );
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const automation = await automationsAPI.create({
        name: name.trim(),
        description: description.trim(),
        trigger_type: triggerType,
        definition: DEFAULT_DEFINITION(triggerType),
      });
      setCreateOpen(false);
      setName("");
      setDescription("");
      navigate(`/comercial/automacoes/${automation.id}`);
    } catch (createError) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Não foi possível criar a automação.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <AppBreadcrumbs />
          <h1 className="mt-3 text-2xl font-semibold">Automações</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie versões e estados dos fluxos comerciais.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/comercial/automacoes/eventos">
              <Eye className="mr-2 h-4 w-4" />
              Eventos
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/comercial/automacoes/runs">
              <Workflow className="mr-2 h-4 w-4" />
              Execuções
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Atualizar"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar automação
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar as automações</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi label="Total" value={counts.total} icon={Workflow} />
            <Kpi label="Ativas" value={counts.active} icon={CheckCircle2} />
            <Kpi label="Pausadas" value={counts.paused} icon={Pause} />
            <Kpi label="Rascunhos" value={counts.draft} icon={Edit3} />
          </div>
          <Card className="rounded-lg border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                Automações cadastradas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma automação criada ainda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Versão ativa</TableHead>
                        <TableHead>Última atualização</TableHead>
                        <TableHead>Criado por</TableHead>
                        <TableHead className="w-[220px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Link
                              className="font-medium hover:text-primary hover:underline"
                              to={`/comercial/automacoes/${item.id}`}
                            >
                              {item.name}
                            </Link>
                          </TableCell>
                          <TableCell>{statusBadge(item.status)}</TableCell>
                          <TableCell>
                            {TRIGGER_LABELS[item.trigger_type] ||
                              item.trigger_type}
                          </TableCell>
                          <TableCell>
                            {item.active_version_number
                              ? `v${item.active_version_number}`
                              : "Nenhuma"}
                          </TableCell>
                          <TableCell>{formatDate(item.updated_at)}</TableCell>
                          <TableCell>
                            {item.created_by_name || "Usuário removido"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.status === "active" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Pausar"
                                  onClick={() => void runAction(item, "pause")}
                                  disabled={!isAdmin}
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                              ) : item.status === "paused" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Ativar"
                                  onClick={() =>
                                    void runAction(item, "activate")
                                  }
                                  disabled={!isAdmin}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              ) : null}
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                title="Abrir"
                              >
                                <Link to={`/comercial/automacoes/${item.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              {item.status !== "archived" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Arquivar"
                                  onClick={() => setDeleteTarget(item)}
                                  disabled={!isAdmin}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar automação</DialogTitle>
            <DialogDescription>
              Crie um rascunho persistente. A execução ainda não está habilitada
              nesta fase.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Nutrição de novos Leads"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Objetivo do fluxo"
              />
            </div>
            <div className="space-y-2">
              <Label>Quando</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void create()}
              disabled={!name.trim() || saving}
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir automação?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name || "Esta automação"} será arquivada e removida da lista padrão. O histórico de execuções será preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (deleteTarget) void runAction(deleteTarget, "archive"); setDeleteTarget(null); }}>Excluir automação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AutomationDetailPage() {
  const { isAdmin } = useAuth();
  const { automationId } = useParams();
  const navigate = useNavigate();
  const id = Number(automationId);
  const [automation, setAutomation] = useState<AutomationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [draftOpen, setDraftOpen] = useState(false);
  const [definitionText, setDefinitionText] = useState("");
  const [definitionViewOpen, setDefinitionViewOpen] = useState(false);
  const [runs, setRuns] = useState<AutomationRun[]>([]);

  const load = async () => {
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("ID da automação inválido.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [data, runPayload] = await Promise.all([
        automationsAPI.get(id),
        automationsAPI.runs(id),
      ]);
      setAutomation(data);
      setRuns(runPayload.runs);
      setName(data.name);
      setDescription(data.description || "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar a automação.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const save = async () => {
    if (!automation || !name.trim()) return;
    try {
      const updated = await automationsAPI.update(automation.id, {
        name: name.trim(),
        description: description.trim(),
      });
      setAutomation(updated);
      setEditing(false);
      toast.success("Automação atualizada.");
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar.",
      );
    }
  };

  const createDraft = async () => {
    if (!automation) return;
    try {
      const parsed = JSON.parse(definitionText) as AutomationDefinition;
      await automationsAPI.createVersion(automation.id, parsed);
      setDraftOpen(false);
      toast.success("Rascunho criado.");
      await load();
    } catch (draftError) {
      toast.error(
        draftError instanceof Error
          ? draftError.message
          : "Definition JSON inválida.",
      );
    }
  };

  const publish = async (_definition?: AutomationDefinition, versionId?: number) => {
    if (!automation) return;
    const targetVersionId = versionId || automation.versions.find((version) => version.status === "draft")?.id;
    if (!targetVersionId) {
      toast.error("Não foi possível preparar o rascunho para publicação.");
      return;
    }
    try {
      await automationsAPI.publish(automation.id, targetVersionId);
      toast.success("Versão publicada.");
      await load();
    } catch (publishError) {
      toast.error(
        publishError instanceof Error
          ? publishError.message
          : "Não foi possível publicar.",
      );
    }
  };

  const transition = async (action: "pause" | "activate" | "archive") => {
    if (!automation) return;
    if (action === "archive" && !window.confirm("Arquivar esta automação?"))
      return;
    try {
      const updated = await automationsAPI[action](automation.id);
      setAutomation((current) =>
        current ? { ...current, ...updated } : current,
      );
      toast.success("Status atualizado.");
    } catch (transitionError) {
      toast.error(
        transitionError instanceof Error
          ? transitionError.message
          : "Não foi possível atualizar o status.",
      );
    }
  };

  if (loading)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (error || !automation)
    return (
      <div className="space-y-4 p-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/comercial/automacoes")}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Automações
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Não foi possível abrir a automação</AlertTitle>
          <AlertDescription>
            {error || "Automação não encontrada."}
          </AlertDescription>
        </Alert>
      </div>
    );

  const draft = automation.versions.find(
    (version) => version.status === "draft",
  );
  const active = automation.versions.find(
    (version) => version.id === automation.active_version_id,
  );
  const visibleDefinition =
    active?.definition ||
    draft?.definition ||
    DEFAULT_DEFINITION(automation.trigger_type);

  const visualBuilder = (
    <AutomationBuilder
      automationId={automation.id}
      triggerType={automation.trigger_type}
      title={automation.name}
      onBack={() => navigate("/comercial/automacoes")}
      draft={draft}
      active={active}
      onSaved={load}
      onPublish={isAdmin && automation.status !== "archived" ? publish : undefined}
      readOnly={!isAdmin || automation.status === "archived"}
    />
  );

  if (isAdmin || automation.status !== "archived") {
    return <div className="fixed inset-0 z-40 overflow-hidden bg-[#0A0A0A]">{visualBuilder}</div>;
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <AppBreadcrumbs />
          <Button
            variant="ghost"
            className="mt-2 px-0"
            onClick={() => navigate("/comercial/automacoes")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Automações
          </Button>
          {editing ? (
            <Input
              className="mt-2 max-w-xl text-xl font-semibold"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : (
            <h1 className="text-2xl font-semibold">{automation.name}</h1>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {automation.description || "Sem descrição"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusBadge(automation.status)}
          {isAdmin ? (
            <>
              {editing ? (
                <Button onClick={() => void save()}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              )}
              {automation.status === "active" ? (
                <Button
                  variant="outline"
                  onClick={() => void transition("pause")}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar
                </Button>
              ) : automation.status === "paused" ? (
                <Button
                  variant="outline"
                  onClick={() => void transition("activate")}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Ativar
                </Button>
              ) : null}
              {automation.status !== "archived" ? (
                <Button
                  variant="outline"
                  onClick={() => void transition("archive")}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Arquivar
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {visualBuilder}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <Card className="rounded-lg border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Versões</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {automation.versions.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Nenhuma versão cadastrada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Versão</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criada em</TableHead>
                        <TableHead>Publicada em</TableHead>
                        <TableHead className="w-[170px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {automation.versions.map((version) => (
                        <TableRow key={version.id}>
                          <TableCell>v{version.version_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {version.status === "draft"
                                ? "Rascunho"
                                : version.status === "published"
                                  ? "Publicada"
                                  : "Substituída"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDate(version.created_at)}
                          </TableCell>
                          <TableCell>
                            {formatDate(version.published_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {version.status === "draft" && isAdmin ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Publicar"
                                  onClick={() => void publish(undefined, version.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Ver definition"
                                onClick={() =>
                                  setDefinitionText(
                                    JSON.stringify(version.definition, null, 2),
                                  )
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-lg border shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Definition da versão ativa
              </CardTitle>
              {isAdmin && !draft && automation.status !== "archived" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDefinitionText(
                      JSON.stringify(visibleDefinition, null, 2),
                    );
                    setDraftOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo rascunho
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/20 p-4 text-xs leading-5">
                {JSON.stringify(visibleDefinition, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card className="rounded-lg border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Execuções</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Nenhuma execução registrada. A engine ainda não executa
                automações.
              </div>
            </CardContent>
          </Card>
        </main>
        <aside className="space-y-5">
          <Card className="rounded-lg border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Trigger</p>
                <p className="font-medium">
                  {TRIGGER_LABELS[automation.trigger_type] ||
                    automation.trigger_type}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Versão ativa</p>
                <p className="font-medium">
                  {automation.active_version_number
                    ? `v${automation.active_version_number}`
                    : "Nenhuma"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Criado por</p>
                <p className="font-medium">
                  {automation.created_by_name || "Usuário removido"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atualizado em</p>
                <p className="font-medium">
                  {formatDate(automation.updated_at)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-lg border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Auditoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {automation.auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum registro de auditoria.
                </p>
              ) : (
                automation.auditLogs.slice(0, 12).map((log) => (
                  <div key={log.id} className="border-b pb-2 last:border-0">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.user_name || "Usuário removido"} ·{" "}
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo rascunho</DialogTitle>
            <DialogDescription>
              O rascunho será validado pelo backend. Publicações não alteram
              versões históricas.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-[420px] font-mono text-xs"
            value={definitionText}
            onChange={(event) => setDefinitionText(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void createDraft()}>
              <Save className="mr-2 h-4 w-4" />
              Salvar rascunho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
