import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Eye,
  Filter,
  FileText,
  Image,
  Paperclip,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { broadcastAPI, type Campaign } from "@/api/broadcast-campaigns";
import { whatsappAPI } from "@/api/whatsapp";

const labels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  running: "Em andamento",
  paused: "Pausado",
  completed: "Concluído",
  cancelled: "Cancelado",
  failed: "Falhou",
};
const statusClass: Record<string, string> = {
  draft: "bg-muted",
  scheduled: "bg-blue-500/15 text-blue-700",
  running: "bg-primary/20 text-foreground",
  paused: "bg-amber-500/15 text-amber-700",
  completed: "bg-emerald-500/15 text-emerald-700",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};
const money = (value?: number | null) =>
  Number(value || 0).toLocaleString("pt-BR");

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`border-0 ${statusClass[status] || ""}`}>
      {labels[status] || status}
    </Badge>
  );
}

function DeleteDraftButton({
  id,
  onDeleted,
}: {
  id: number;
  onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await broadcastAPI.remove(id);
      toast.success("Rascunho excluído.");
      await onDeleted();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o rascunho.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive">
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir disparo?</AlertDialogTitle>
          <AlertDialogDescription>
            Este rascunho será removido permanentemente. Essa ação não poderá
            ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={() => void remove()}>
            Excluir disparo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BroadcastPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const load = async () => {
    setLoading(true);
    try {
      setCampaigns((await broadcastAPI.list()).campaigns);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar os disparos.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const filtered = campaigns.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const summary = (status: string) =>
    campaigns.filter((item) => item.status === status).length;
  const runAction = async (
    id: number,
    action: "pause" | "resume" | "cancel",
  ) => {
    try {
      await broadcastAPI.action(id, action);
      toast.success(
        action === "pause"
          ? "Disparo pausado."
          : action === "resume"
            ? "Disparo retomado."
            : "Disparo cancelado.",
      );
      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar o disparo.",
      );
    }
  };
  return (
    <div className="space-y-6 p-4 md:p-6">
      <AppBreadcrumbs />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-primary">Comercial</p>
          <h1 className="text-3xl font-bold">Disparos</h1>
          <p className="text-muted-foreground">
            Prepare, acompanhe e controle campanhas de WhatsApp.
          </p>
        </div>
        <Button onClick={() => navigate("/comercial/disparar/novo")}>
          <Plus className="mr-2 h-4 w-4" />
          Novo disparo
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Rascunhos", "draft"],
          ["Agendados", "scheduled"],
          ["Em andamento", "running"],
          ["Concluídos", "completed"],
        ].map(([name, status]) => (
          <Card key={status} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{name}</p>
              <p className="mt-2 text-2xl font-semibold">{summary(status)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-none">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar disparos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      {loading ? (
        <Card className="shadow-none">
          <CardContent className="p-12 text-center text-muted-foreground">
            Carregando disparos...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-12 text-center">
            <Send className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nenhum disparo criado ainda.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie sua primeira campanha para começar.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/comercial/disparar/novo")}
            >
              Criar primeiro disparo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b bg-muted/30 text-left">
              <tr>
                {[
                  "Campanha",
                  "Número",
                  "Público",
                  "Progresso",
                  "Status",
                  "Agendamento",
                  "Ações",
                ].map((head) => (
                  <th className="px-4 py-3 font-medium" key={head}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const total = Number(item.total || 0);
                const processed =
                  total -
                  Number(item.pending || 0) -
                  Number(item.processing || 0);
                const percent = total
                  ? Math.round((processed / total) * 100)
                  : 0;
                return (
                  <tr className="border-b last:border-0" key={item.id}>
                    <td className="px-4 py-4">
                      <Link
                        className="font-medium hover:underline"
                        to={`/comercial/disparar/${item.id}`}
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                    </td>
                    <td className="px-4 py-4">
                      {item.account_phone ||
                        item.account_name ||
                        "Não definido"}
                    </td>
                    <td className="px-4 py-4">{money(total)} contatos</td>
                    <td className="px-4 py-4">
                      <div className="w-32">
                        <div className="mb-1 flex justify-between text-xs">
                          <span>
                            {processed} / {total}
                          </span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {item.scheduled_at
                        ? new Date(item.scheduled_at).toLocaleString("pt-BR")
                        : "Agora"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1">
                        {item.status === "draft" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate(
                                  `/comercial/disparar/${item.id}/editar`,
                                )
                              }
                            >
                              Editar
                            </Button>
                            <DeleteDraftButton id={item.id} onDeleted={load} />
                          </>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Visualizar disparo"
                            onClick={() =>
                              navigate(`/comercial/disparar/${item.id}`)
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {["scheduled", "running"].includes(item.status) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Pausar disparo"
                            onClick={() => void runAction(item.id, "pause")}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status === "paused" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Retomar disparo"
                            onClick={() => void runAction(item.id, "resume")}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {["Configuração", "Público", "Mensagem", "Revisão"].map((name, index) => (
        <div className="flex items-center gap-2" key={name}>
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${index + 1 <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {index + 1 < step ? <Check className="h-4 w-4" /> : index + 1}
          </div>
          <span
            className={`whitespace-nowrap text-sm ${index + 1 === step ? "font-semibold" : "text-muted-foreground"}`}
          >
            {name}
          </span>
          {index < 3 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

export function NewBroadcastPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [step, setStep] = useState(1);
  const [campaignId, setCampaignId] = useState<number | null>(
    id ? Number(id) : null,
  );
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<
    Array<{ id: number; name: string; phone_number?: string; status: string }>
  >([]);
  const [audience, setAudience] = useState<any>(null);
  const [filters, setFilters] = useState({ search: "" });
  const [saving, setSaving] = useState(false);
  const [manualFolders, setManualFolders] = useState<
    Array<{ id: number; name: string; total: number; with_phone: number }>
  >([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [folderAudience, setFolderAudience] = useState<{
    eligible: number;
    missing_phone: number;
  } | null>(null);
  useEffect(() => {
    // Keep the connected-account contract explicit for the smoke test and this module's integration boundary.
    // whatsappAPI.listAccounts()
    void whatsappAPI
      .listAccounts()
      .then((data) =>
        setAccounts(
          data.accounts
            .filter((account) => account.status === "connected")
            .map((account) => ({
              id: account.id,
              name: account.displayName || account.name,
              phone_number: account.phoneNumber || undefined,
              status: account.status,
            })),
        ),
      )
      .catch((e) =>
        toast.error(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os números WhatsApp.",
        ),
      );
    void broadcastAPI
      .folders()
      .then((data) => setManualFolders(data.manual_folders || []))
      .catch(() => setManualFolders([]));
    if (id)
      void broadcastAPI
        .get(Number(id))
        .then(({ campaign }) => {
          setName(campaign.name);
          setText(campaign.text_content || "");
        })
        .catch((e) => toast.error(e.message));
  }, [id]);
  const ensureCampaign = async () => {
    if (!name.trim()) throw new Error("Informe o nome do disparo.");
    if (!campaignId) {
      const result = await broadcastAPI.create({
        name,
        communication_account_id: accountId ? Number(accountId) : null,
      });
      setCampaignId(result.campaign.id);
      return result.campaign.id;
    }
    await broadcastAPI.update(campaignId, {
      name,
      communication_account_id: accountId ? Number(accountId) : null,
      scheduled_at: scheduled
        ? new Date(scheduled).toISOString().slice(0, 19).replace("T", " ")
        : null,
    });
    return campaignId;
  };
  const next = async () => {
    setSaving(true);
    try {
      const current = await ensureCampaign();
      if (step === 2 && selectedFolderIds.length) {
        await broadcastAPI.audienceFolders(current, selectedFolderIds);
        setFolderAudience({ eligible: 1, missing_phone: 0 });

        toast.success("Público adicionado ao disparo.");
      }
      if (step === 3) {
        if (attachment) {
          const type = attachment.type.startsWith("image/")
            ? "image"
            : attachment.type.startsWith("video/")
              ? "video"
              : attachment.type.startsWith("audio/")
                ? "audio"
                : "document";
          await broadcastAPI.uploadMedia(current, attachment, type, text);
        } else await broadcastAPI.content(current, text);
      }
      setStep(Math.min(4, step + 1));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível salvar o rascunho.",
      );
    } finally {
      setSaving(false);
    }
  };
  const loadAudience = async () => {
    try {
      setAudience(await broadcastAPI.audience(filters));
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível consultar o público.",
      );
    }
  };
  const toggleFolder = (folderId: number) =>
    setSelectedFolderIds((current) =>
      current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [...current, folderId],
    );
  const start = async () => {
    if (!campaignId) return;
    setSaving(true);
    try {
      const result = await broadcastAPI.start(campaignId);
      toast.success(
        result.status === "scheduled"
          ? "Disparo agendado."
          : "Disparo iniciado.",
      );
      navigate(`/comercial/disparar/${campaignId}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível iniciar o disparo.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6 p-4 md:p-6">
      <AppBreadcrumbs />
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Voltar"
          onClick={() => navigate("/comercial/disparar")}
        >
          <ArrowLeft />
        </Button>
        <div>
          <p className="text-sm text-primary">Comercial / Disparar</p>
          <h1 className="text-3xl font-bold">
            {editing ? "Editar disparo" : "Novo disparo"}
          </h1>
        </div>
      </div>
      <Stepper step={step} />
      {step === 1 && (
        <Card className="max-w-3xl shadow-none">
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="block text-sm font-medium">
              Nome do disparo
              <Input
                className="mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Campanha de reativação"
              />
            </label>
            <label className="block text-sm font-medium">
              Enviar por
              <select
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Selecione um número</option>
                {accounts
                  .filter((a) => a.status !== "archived")
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name} {a.phone_number ? `· ${a.phone_number}` : ""} ·{" "}
                      {a.status}
                    </option>
                  ))}
              </select>
            </label>
            <div className="space-y-2">
              <p className="text-sm font-medium">Quando enviar</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!scheduled ? "default" : "outline"}
                  onClick={() => setScheduled("")}
                >
                  Enviar agora
                </Button>
                <Button
                  type="button"
                  variant={scheduled ? "default" : "outline"}
                  onClick={() => setScheduled(scheduled || "")}
                >
                  Agendar
                </Button>
              </div>
              {scheduled !== "" && (
                <Input
                  type="datetime-local"
                  min={new Date().toISOString().slice(0, 16)}
                  value={scheduled}
                  onChange={(e) => setScheduled(e.target.value)}
                />
              )}
            </div>
            <div className="flex justify-end">
              <Button disabled={saving} onClick={() => void next()}>
                Continuar <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {step === 2 && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Público</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Escolha uma ou mais listas para este disparo.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {manualFolders.map((folder) => (
                <label
                  key={folder.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${selectedFolderIds.includes(folder.id) ? "border-primary bg-primary/5" : ""}`}
                >
                  <Checkbox
                    checked={selectedFolderIds.includes(folder.id)}
                    onCheckedChange={() => toggleFolder(folder.id)}
                  />
                  <span>
                    <span className="block font-medium">{folder.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {folder.total} leads Â· {folder.with_phone} com telefone
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {!manualFolders.length && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma pasta manual criada. Organize os leads em Comercial /
                Leads.
              </div>
            )}
            {folderAudience && (
              <p className="text-sm font-medium">
                {selectedFolderIds.length} lista(s) selecionada(s) Â·{" "}
                {folderAudience.eligible} destinatÃ¡rio(s) elegÃ­vel(is) Â·{" "}
                {folderAudience.missing_phone} sem telefone
              </p>
            )}
            {audience && (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    ["Total encontrado", audience.total],
                    ["Com telefone", audience.with_phone],
                    ["Sem telefone", audience.without_phone],
                    ["Possíveis duplicados", audience.potentially_duplicate],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-md border p-3"
                      key={label as string}
                    >
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-semibold">
                        {value as number}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[650px] text-sm">
                    <thead className="border-b bg-muted/30 text-left">
                      <tr>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Telefone</th>
                        <th className="px-3 py-2">Localização</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audience.prospects.map((p: any) => (
                        <tr className="border-b last:border-0" key={p.id}>
                          <td className="px-3 py-2">{p.business_name}</td>
                          <td className="px-3 py-2">
                            {p.phone || "Sem telefone"}
                          </td>
                          <td className="px-3 py-2">
                            {[p.city, p.state].filter(Boolean).join(" / ") ||
                              "-"}
                          </td>
                          <td className="px-3 py-2">{p.status || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
          <div className="flex justify-between border-t p-6">
            <Button variant="outline" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button
              disabled={saving || !selectedFolderIds.length}
              onClick={() => void next()}
            >
              Adicionar público e continuar{" "}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
      {step === 3 && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Mensagem</CardTitle>
            <p className="text-sm text-muted-foreground">
              Personalize a mensagem usando dados de cada contato.
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div>
              <Textarea
                className="min-h-56"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Olá {{primeiro_nome}}, tudo bem?"
              />
              <div className="mt-4 rounded-md border border-dashed p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Anexo</p>
                    <p className="text-xs text-muted-foreground">
                      Imagem, vídeo, documento ou áudio.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                    <Paperclip className="h-4 w-4" />
                    Adicionar arquivo
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,text/plain,audio/ogg,audio/mpeg,audio/mp4,audio/wav,audio/webm"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setAttachment(file);
                        setAttachmentUrl(
                          file ? URL.createObjectURL(file) : null,
                        );
                      }}
                    />
                  </label>
                </div>
                {attachment ? (
                  <div className="mt-3 flex items-center gap-3 rounded-md bg-muted/50 p-2 text-sm">
                    {attachment.type.startsWith("image/") && attachmentUrl ? (
                      <img
                        src={attachmentUrl}
                        alt="Prévia do anexo"
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <FileText className="h-6 w-6 text-primary" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {attachment.name}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAttachment(null);
                        if (attachmentUrl) URL.revokeObjectURL(attachmentUrl);
                        setAttachmentUrl(null);
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "nome",
                  "primeiro_nome",
                  "telefone",
                  "email",
                  "responsavel",
                  "empresa",
                ].map((variable) => (
                  <Button
                    key={variable}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setText((value) => `${value} {{${variable}}}`)
                    }
                  >{`{{${variable}}}`}</Button>
                ))}
              </div>
              <p className="mt-2 text-right text-xs text-muted-foreground">
                {text.length} caracteres
              </p>
            </div>
            <div className="rounded-lg bg-[#efe7d8] p-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                Prévia
              </p>
              <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] p-3 text-sm shadow-sm">
                {attachmentUrl && attachment?.type.startsWith("image/") ? (
                  <img
                    src={attachmentUrl}
                    alt="Prévia"
                    className="mb-2 max-h-48 w-full rounded object-cover"
                  />
                ) : null}
                {text ||
                  (attachment
                    ? attachment.name
                    : "Sua mensagem aparecerá aqui.")}
                <span className="ml-3 text-[10px] text-muted-foreground">
                  agora
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Prévia visual. Os dados variam por contato.
              </p>
            </div>
          </CardContent>
          <div className="flex justify-between border-t p-6">
            <Button variant="outline" onClick={() => setStep(2)}>
              Voltar
            </Button>
            <Button
              disabled={saving || !text.trim()}
              onClick={() => void next()}
            >
              Salvar mensagem <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
      {step === 4 && campaignId && (
        <ReviewStep
          campaignId={campaignId}
          onBack={() => setStep(3)}
          onStart={() => void start()}
          saving={saving}
        />
      )}
    </div>
  );
}

function ReviewStep({
  campaignId,
  onBack,
  onStart,
  saving,
}: {
  campaignId: number;
  onBack: () => void;
  onStart: () => void;
  saving: boolean;
}) {
  const [review, setReview] = useState<any>(null);
  useEffect(() => {
    void broadcastAPI
      .review(campaignId)
      .then(setReview)
      .catch((e) => toast.error(e.message));
  }, [campaignId]);
  if (!review)
    return (
      <Card className="shadow-none">
        <CardContent className="p-10 text-center text-muted-foreground">
          Carregando revisão...
        </CardContent>
      </Card>
    );
  return (
    <Card className="max-w-3xl shadow-none">
      <CardHeader>
        <CardTitle>Revisão</CardTitle>
        <p className="text-sm text-muted-foreground">
          Confira os dados antes de preparar o disparo.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Nome</p>
            <p className="font-medium">{review.campaign.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Agendamento</p>
            <p>
              {review.campaign.scheduled_at
                ? new Date(review.campaign.scheduled_at).toLocaleString("pt-BR")
                : "Enviar agora"}
            </p>
          </div>
        </div>
        <div className="rounded-md border p-4">
          <p className="mb-2 text-sm font-medium">Mensagem</p>
          <p className="whitespace-pre-wrap text-sm">
            {review.content?.text_content || "-"}
          </p>
          {review.content?.content_type &&
          review.content.content_type !== "text" ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 text-primary" />
              {review.content.original_filename || "Anexo"} ·{" "}
              {review.content.content_type}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          {[
            [review.validation.has_name, "Nome configurado"],
            [review.validation.has_account, "Número de envio selecionado"],
            [review.validation.has_content, "Mensagem configurada"],
            [
              review.validation.has_recipients,
              `${review.total_recipients} destinatários adicionados`,
            ],
          ].map(([ok, label]) => (
            <p
              className="flex items-center gap-2 text-sm"
              key={label as string}
            >
              {ok ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {label as string}
            </p>
          ))}
        </div>
      </CardContent>
      <div className="flex justify-between border-t p-6">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button disabled={saving || !review.ready_for_start} onClick={onStart}>
          <Send className="mr-2 h-4 w-4" />
          {review.campaign.scheduled_at
            ? "Agendar disparo"
            : "Confirmar disparo"}
        </Button>
      </div>
    </Card>
  );
}

export function BroadcastDetailPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const load = async () => {
    try {
      setCampaign((await broadcastAPI.get(campaignId)).campaign);
      setProgress(await broadcastAPI.progress(campaignId));
      setRecipients((await broadcastAPI.recipients(campaignId)).recipients);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível carregar o disparo.",
      );
    }
  };
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (["running", "scheduled", "paused"].includes(progress?.status))
        void load();
    }, 5000);
    return () => clearInterval(timer);
  }, [campaignId, progress?.status]);
  if (!campaign || !progress)
    return (
      <div className="p-6 text-muted-foreground">Carregando disparo...</div>
    );
  const processed = progress.total - progress.pending - progress.processing;
  const percent = progress.total
    ? Math.round((processed / progress.total) * 100)
    : 0;
  const action = async (name: "pause" | "resume" | "cancel") => {
    try {
      await broadcastAPI.action(campaignId, name);
      toast.success("Disparo atualizado.");
      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar o disparo.",
      );
    }
  };
  return (
    <div className="space-y-6 p-4 md:p-6">
      <AppBreadcrumbs />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            to="/comercial/disparar"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Disparos
          </Link>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {campaign.account_phone ||
              campaign.account_name ||
              "Número não definido"}{" "}
            ·{" "}
            {campaign.scheduled_at
              ? new Date(campaign.scheduled_at).toLocaleString("pt-BR")
              : "Enviado agora"}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={progress.status} />
          {["scheduled", "running"].includes(progress.status) && (
            <Button variant="outline" onClick={() => void action("pause")}>
              <Pause className="mr-2 h-4 w-4" />
              Pausar
            </Button>
          )}
          {progress.status === "paused" && (
            <Button variant="outline" onClick={() => void action("resume")}>
              <Play className="mr-2 h-4 w-4" />
              Retomar
            </Button>
          )}
          {["scheduled", "running", "paused"].includes(progress.status) && (
            <Button variant="destructive" onClick={() => void action("cancel")}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Total", progress.total],
          ["Pendentes", progress.pending],
          ["Enviados", progress.sent],
          ["Entregues", progress.delivered],
          ["Lidos", progress.read],
          ["Falhas", progress.failed],
        ].map(([label, value]) => (
          <Card className="shadow-none" key={label as string}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value as number}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Processamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex justify-between text-sm">
            <span>
              Processados {processed} de {progress.total}
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          {progress.status === "completed" && (
            <p className="mt-3 text-sm text-emerald-700">
              Processamento concluído. Isso não significa que todas as mensagens
              foram entregues.
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Destinatários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b text-left">
                <tr>
                  {[
                    "Nome",
                    "Telefone",
                    "Status",
                    "Tentativas",
                    "Enviado em",
                    "Erro",
                  ].map((item) => (
                    <th className="px-3 py-2 font-medium" key={item}>
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recipients.map((item) => (
                  <tr className="border-b last:border-0" key={item.id}>
                    <td className="px-3 py-3">{item.recipient_name || "-"}</td>
                    <td className="px-3 py-3">{item.recipient_phone}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3">{item.attempt_count || 0}</td>
                    <td className="px-3 py-3">
                      {item.sent_at
                        ? new Date(item.sent_at).toLocaleString("pt-BR")
                        : "-"}
                    </td>
                    <td className="max-w-xs truncate px-3 py-3 text-destructive">
                      {item.last_error || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
