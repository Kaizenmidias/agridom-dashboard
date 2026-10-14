import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  ArrowLeft,
  CalendarClock,
  FileText,
  Filter,
  Inbox,
  Mail,
  Maximize2,
  Menu,
  Minimize2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { broadcastAPI, type Campaign } from "@/api/broadcast-campaigns";
import { EmailVisualEditor } from "@/components/email-marketing/EmailVisualEditor";
import { emailHtmlToText, sanitizeEmailHtml } from "@/lib/email-html";

type MailboxSection =
  | "campaigns"
  | "drafts"
  | "scheduled"
  | "sent"
  | "paused"
  | "suppression";
type ComposerSize = "normal" | "minimized" | "expanded";

type Provider = {
  id: number | string;
  provider?: "smtp" | "gmail";
  name?: string;
  from_email?: string;
  status: string;
};

type Folder = {
  id: number;
  name: string;
  total: number;
  with_phone: number;
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  running: "Em andamento",
  paused: "Pausada",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

const statusStyles: Record<string, string> = {
  draft: "border-zinc-600 text-zinc-300",
  scheduled: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  running: "border-[#BEFA33]/40 bg-[#BEFA33]/10 text-[#BEFA33]",
  paused: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/40 bg-red-500/10 text-red-300",
  cancelled: "border-zinc-600 text-zinc-400",
};

const mailboxItems: Array<{
  key: MailboxSection;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "campaigns", label: "Campanhas", icon: Mail },
  { key: "drafts", label: "Rascunhos", icon: FileText },
  { key: "scheduled", label: "Agendados", icon: CalendarClock },
  { key: "sent", label: "Enviados", icon: Send },
  { key: "paused", label: "Pausados", icon: Pause },
  { key: "suppression", label: "Descadastros", icon: ShieldCheck },
];

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: parsed.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(parsed);
}

function stripHtml(value?: string | null) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`whitespace-nowrap text-[11px] font-medium ${statusStyles[status] || statusStyles.draft}`}
    >
      {statusLabels[status] || status}
    </Badge>
  );
}

export default function EmailMarketingPage() {
  const [section, setSection] = useState<MailboxSection>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignResult, providerResult, folderResult] = await Promise.all([
        broadcastAPI.list(),
        broadcastAPI.emailProviders(),
        broadcastAPI.folders(),
      ]);
      setCampaigns(campaignResult.campaigns || []);
      setProviders(providerResult.providers || []);
      setFolders(folderResult.manual_folders || []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o E-mail Marketing.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      drafts: campaigns.filter((item) => item.status === "draft").length,
      scheduled: campaigns.filter((item) => item.status === "scheduled").length,
      paused: campaigns.filter((item) => item.status === "paused").length,
    }),
    [campaigns],
  );

  const filteredCampaigns = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return campaigns.filter((campaign) => {
      const isEmail =
        campaign.channel === "email" ||
        campaign.channel === "both" ||
        campaign.channels?.includes("email");
      if (!isEmail) return false;
      const matchesSearch =
        !term ||
        campaign.name.toLocaleLowerCase("pt-BR").includes(term) ||
        String(campaign.email_subject || "")
          .toLocaleLowerCase("pt-BR")
          .includes(term);
      if (!matchesSearch) return false;
      if (section === "drafts") return campaign.status === "draft";
      if (section === "scheduled") return campaign.status === "scheduled";
      if (section === "paused") return campaign.status === "paused";
      if (section === "sent")
        return ["completed", "failed", "cancelled"].includes(campaign.status);
      return true;
    });
  }, [campaigns, search, section]);

  const openCampaign = async (campaign: Campaign) => {
    try {
      const detail = await broadcastAPI.get(campaign.id);
      setSelectedCampaign({ ...campaign, ...detail.campaign });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível abrir a campanha.",
      );
    }
  };

  const runCampaignAction = async (
    campaign: Campaign,
    action: "pause" | "resume",
  ) => {
    try {
      await broadcastAPI.action(campaign.id, action);
      toast.success(action === "pause" ? "Campanha pausada." : "Campanha retomada.");
      setSelectedCampaign(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível atualizar a campanha.",
      );
    }
  };

  const activeProvider = providers.find(
    (provider) => provider.provider === "gmail" && provider.status === "connected",
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#101212] text-foreground">
      <div className="sr-only">
        <AppBreadcrumbs />
      </div>

      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-3 md:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir menu do E-mail Marketing"
          onClick={() => setSidebarOpen((current) => !current)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden min-w-56 items-center gap-3 lg:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#BEFA33]/15 text-[#BEFA33]">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">E-mail Marketing</p>
            <p className="text-[11px] text-zinc-500">Kaizen Comercial</p>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-3xl">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 rounded-full border-transparent bg-[#252829] pl-11 pr-12 text-sm shadow-none placeholder:text-zinc-500 focus-visible:border-[#BEFA33]/40 focus-visible:ring-0"
            placeholder="Pesquisar em campanhas de e-mail"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
            title="Filtrar campanhas"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <Filter className="h-4 w-4" />
          </Button>
          {filtersOpen ? (
            <div className="absolute right-0 top-12 z-40 w-52 overflow-hidden rounded-md border border-white/10 bg-[#252829] py-1 shadow-xl">
              {mailboxItems
                .filter((item) => item.key !== "suppression")
                .map((item) => (
                  <button
                    key={item.key}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                      section === item.key
                        ? "bg-[#BEFA33]/10 text-[#BEFA33]"
                        : "text-zinc-300 hover:bg-white/5"
                    }`}
                    onClick={() => {
                      setSection(item.key);
                      setSelectedCampaign(null);
                      setFiltersOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex"
          title="Preferências de comunicação"
          onClick={() => setSection("suppression")}
        >
          <Settings2 className="h-5 w-5" />
        </Button>
        <div className="hidden max-w-56 items-center gap-2 rounded-full border border-white/10 bg-[#1b1e1f] px-3 py-2 md:flex">
          <span className={`h-2 w-2 rounded-full ${activeProvider ? "bg-[#BEFA33]" : "bg-zinc-600"}`} />
          <span className="truncate text-xs text-zinc-300">
            {activeProvider?.from_email || "Gmail não conectado"}
          </span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen ? (
          <button
            className="absolute inset-0 z-20 bg-black/60 lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        <aside
          className={`absolute inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col bg-[#151718] px-3 py-4 transition-transform lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Button
            className="mb-5 h-12 w-fit min-w-36 justify-start rounded-2xl bg-[#BEFA33] px-5 text-zinc-950 hover:bg-[#aee82f]"
            onClick={() => {
              setEditingCampaign(null);
              setComposerOpen(true);
              setSidebarOpen(false);
            }}
          >
            <Plus className="mr-3 h-5 w-5" />
            Escrever
          </Button>
          <nav className="space-y-1">
            {mailboxItems.map(({ key, label, icon: Icon }) => {
              const count =
                key === "drafts"
                  ? counts.drafts
                  : key === "scheduled"
                    ? counts.scheduled
                    : key === "paused"
                      ? counts.paused
                      : 0;
              return (
                <button
                  key={key}
                  className={`flex h-10 w-full items-center gap-3 rounded-r-full px-4 text-sm transition-colors ${
                    section === key
                      ? "bg-[#BEFA33]/15 font-medium text-[#BEFA33]"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  }`}
                  onClick={() => {
                    setSection(key);
                    setSelectedCampaign(null);
                    setSidebarOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {count ? <span className="ml-auto text-xs">{count}</span> : null}
                </button>
              );
            })}
            <div
              className="flex h-10 items-center gap-3 px-4 text-sm text-zinc-600"
              title="A leitura de mensagens Gmail ainda não está implementada"
              aria-disabled="true"
            >
              <Inbox className="h-4 w-4" />
              <span>Caixa de entrada</span>
              <span className="ml-auto text-[10px] uppercase">Em breve</span>
            </div>
          </nav>
          <div className="mt-auto border-t border-white/10 px-4 pt-4 text-xs leading-relaxed text-zinc-500">
            Envios de campanha respeitam consentimento, descadastros e supressões.
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-[#17191a]">
          {selectedCampaign ? (
            <CampaignDetail
              campaign={selectedCampaign}
              onBack={() => setSelectedCampaign(null)}
              onAction={runCampaignAction}
              onEdit={() => {
                setEditingCampaign(selectedCampaign);
                setComposerOpen(true);
              }}
            />
          ) : section === "suppression" ? (
            <SuppressionView />
          ) : (
            <CampaignMailbox
              title={mailboxItems.find((item) => item.key === section)?.label || "Campanhas"}
              campaigns={filteredCampaigns}
              loading={loading}
              onOpen={openCampaign}
              onRefresh={load}
              onCompose={() => {
                setEditingCampaign(null);
                setComposerOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {composerOpen ? (
        <EmailComposer
          providers={providers}
          folders={folders}
          initialCampaign={editingCampaign}
          onClose={() => {
            setComposerOpen(false);
            setEditingCampaign(null);
          }}
          onSaved={async () => {
            setComposerOpen(false);
            setEditingCampaign(null);
            setSelectedCampaign(null);
            setSection("drafts");
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function CampaignMailbox({
  title,
  campaigns,
  loading,
  onOpen,
  onRefresh,
  onCompose,
}: {
  title: string;
  campaigns: Campaign[];
  loading: boolean;
  onOpen: (campaign: Campaign) => void;
  onRefresh: () => Promise<void>;
  onCompose: () => void;
}) {
  return (
    <section className="flex h-full min-h-[calc(100vh-8rem)] flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-white/10 px-3 md:px-5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Atualizar campanhas"
          onClick={() => void onRefresh()}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <p className="ml-2 text-sm font-medium text-zinc-300">{title}</p>
        <span className="ml-auto text-xs text-zinc-500">
          {campaigns.length} {campaigns.length === 1 ? "campanha" : "campanhas"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse border-b border-white/5 bg-white/[0.025]" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-zinc-500">
              <Mail className="h-6 w-6" />
            </span>
            <h2 className="text-base font-medium">Nenhuma campanha nesta seção</h2>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              Crie um rascunho para preparar conteúdo, público e agendamento com as regras de comunicação do CRM.
            </p>
            <Button className="mt-5 bg-[#BEFA33] text-zinc-950 hover:bg-[#aee82f]" onClick={onCompose}>
              <Plus className="mr-2 h-4 w-4" /> Escrever campanha
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {campaigns.map((campaign) => {
              const recipients = Number(campaign.total || 0);
              const subject = campaign.email_subject || "Assunto disponível nos detalhes";
              const preview = stripHtml(campaign.email_body_text || campaign.text_content);
              const date = campaign.scheduled_at || campaign.updated_at || campaign.created_at;
              return (
                <button
                  key={campaign.id}
                  className="group grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-[#1b1d1e] px-4 text-left transition-colors hover:bg-[#252829] md:grid-cols-[minmax(150px,0.8fr)_minmax(260px,2fr)_auto_auto] md:px-5"
                  onClick={() => void onOpen(campaign)}
                >
                  <span className="min-w-0 truncate text-sm font-medium text-zinc-100">
                    {campaign.name}
                  </span>
                  <span className="hidden min-w-0 truncate text-sm text-zinc-400 md:block">
                    <span className="text-zinc-200">{subject}</span>
                    {preview ? <span className="text-zinc-500"> - {preview}</span> : null}
                  </span>
                  <span className="hidden items-center gap-2 text-xs text-zinc-500 md:flex">
                    <StatusBadge status={campaign.status} />
                    <span>{recipients} destinatários</span>
                  </span>
                  <span className="whitespace-nowrap text-xs text-zinc-500">{formatDate(date)}</span>
                  <span className="col-span-2 flex items-center gap-2 truncate text-xs text-zinc-500 md:hidden">
                    <StatusBadge status={campaign.status} />
                    <span>{recipients} destinatários</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function CampaignDetail({
  campaign,
  onBack,
  onAction,
  onEdit,
}: {
  campaign: Campaign;
  onBack: () => void;
  onAction: (campaign: Campaign, action: "pause" | "resume") => Promise<void>;
  onEdit: () => void;
}) {
  const body = stripHtml(campaign.email_body_text || campaign.text_content);
  return (
    <section className="flex min-h-[calc(100vh-8rem)] flex-col">
      <div className="flex h-12 items-center gap-1 border-b border-white/10 px-3 md:px-5">
        <Button variant="ghost" size="icon" aria-label="Voltar para campanhas" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {campaign.status === "draft" ? (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Editar rascunho
          </Button>
        ) : null}
        {campaign.status === "paused" ? (
          <Button variant="ghost" size="sm" onClick={() => void onAction(campaign, "resume")}>
            <Play className="mr-2 h-4 w-4" /> Retomar
          </Button>
        ) : ["running", "scheduled"].includes(campaign.status) ? (
          <Button variant="ghost" size="sm" onClick={() => void onAction(campaign, "pause")}>
            <Pause className="mr-2 h-4 w-4" /> Pausar
          </Button>
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-7 md:px-10">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-medium text-zinc-100">
              {campaign.email_subject || campaign.name}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Campanha: <span className="text-zinc-300">{campaign.name}</span>
            </p>
          </div>
          <StatusBadge status={campaign.status} />
        </div>
        <div className="flex items-center gap-3 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#BEFA33]/15 font-semibold text-[#BEFA33]">
            K
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {campaign.account_name || campaign.email_provider || "Conta de e-mail"}
            </p>
            <p className="text-xs text-zinc-500">
              {Number(campaign.total || 0)} destinatários · {formatDate(campaign.scheduled_at || campaign.created_at)}
            </p>
          </div>
        </div>
        <article className="min-h-52 whitespace-pre-wrap py-4 text-sm leading-7 text-zinc-300">
          {body || "O conteúdo desta campanha não está disponível na listagem."}
        </article>
        <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            ["Destinatários", campaign.total || 0],
            ["Enviados", campaign.sent || 0],
            ["Falhas", campaign.failed || 0],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#1b1d1e] px-4 py-3">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SuppressionView() {
  return (
    <section className="min-h-[calc(100vh-8rem)]">
      <div className="flex h-12 items-center border-b border-white/10 px-5">
        <h1 className="text-sm font-medium">Descadastros e preferências</h1>
      </div>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <ShieldCheck className="h-8 w-8 text-[#BEFA33]" />
        <h2 className="mt-5 text-xl font-medium">Preferências de comunicação protegidas</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          O CRM revalida consentimento, bloqueios e descadastros antes de adicionar destinatários e novamente antes de cada envio.
        </p>
        <p className="mt-4 text-sm leading-6 text-zinc-500">
          A consulta e a atualização individual permanecem disponíveis em Comercial → Leads. Um descadastro não é removido por uma edição comum do contato.
        </p>
      </div>
    </section>
  );
}

function EmailComposer({
  providers,
  folders,
  initialCampaign,
  onClose,
  onSaved,
}: {
  providers: Provider[];
  folders: Folder[];
  initialCampaign: Campaign | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [size, setSize] = useState<ComposerSize>("normal");
  const [mode, setMode] = useState<"campaign" | "individual">("campaign");
  const [name, setName] = useState(initialCampaign?.name || "");
  const [providerId, setProviderId] = useState(
    initialCampaign?.email_provider_id ? String(initialCampaign.email_provider_id) : "",
  );
  const [subject, setSubject] = useState(initialCampaign?.email_subject || "");
  const [bodyHtml, setBodyHtml] = useState(
    initialCampaign?.email_html || initialCampaign?.email_body_text || "",
  );
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (providerId) return;
    const gmail = providers.find(
      (provider) => provider.provider === "gmail" && provider.status === "connected",
    );
    if (gmail) setProviderId(String(gmail.id));
    else if (providers[0]) setProviderId(String(providers[0].id));
  }, [providerId, providers]);

  const selectedProvider = providers.find(
    (provider) => String(provider.id) === providerId,
  );
  const selectedCount = folders
    .filter((folder) => selectedFolderIds.includes(folder.id))
    .reduce((total, folder) => total + Number(folder.total || 0), 0);

  const saveDraft = async () => {
    if (mode === "individual") {
      toast.info("O envio individual ainda não possui um endpoint de produção neste módulo.");
      return;
    }
    if (!name.trim() || !providerId || !subject.trim() || !emailHtmlToText(bodyHtml)) {
      toast.error("Preencha nome, remetente, assunto e conteúdo.");
      return;
    }
    if (!initialCampaign && !selectedFolderIds.length) {
      toast.error("Selecione ao menos uma lista de contatos.");
      return;
    }
    setSaving(true);
    try {
      const provider = providers.find((item) => String(item.id) === providerId);
      const campaignPayload = {
        name: name.trim(),
        channels: ["email"],
        email_provider: provider?.provider === "gmail" ? "gmail" : "smtp",
        email_provider_id: provider?.provider === "gmail" ? null : Number(providerId),
      };
      const campaignId = initialCampaign
        ? (await broadcastAPI.update(initialCampaign.id, campaignPayload)).campaign.id
        : (await broadcastAPI.create(campaignPayload)).campaign.id;
      if (selectedFolderIds.length) {
        await broadcastAPI.audienceFolders(campaignId, selectedFolderIds);
      }
      const safeHtml = sanitizeEmailHtml(bodyHtml);
      await broadcastAPI.content(campaignId, {
        content_type: "text",
        email_subject: subject.trim(),
        email_body_text: emailHtmlToText(safeHtml),
        email_html: safeHtml,
      });
      toast.success(initialCampaign ? "Rascunho atualizado." : "Rascunho salvo com o público selecionado.");
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar o rascunho.",
      );
    } finally {
      setSaving(false);
    }
  };

  const composerClasses =
    size === "expanded"
      ? "inset-3 md:inset-8"
      : size === "minimized"
        ? "bottom-0 right-3 h-12 w-[min(92vw,520px)]"
        : "bottom-0 right-0 h-[min(78vh,690px)] w-full md:right-6 md:w-[min(680px,calc(100vw-3rem))]";

  return (
    <section
      className={`fixed z-50 flex flex-col overflow-hidden border border-white/15 bg-[#1b1d1e] shadow-2xl shadow-black/60 transition-all md:rounded-t-xl ${composerClasses}`}
      aria-label="Compositor de e-mail"
    >
      <div className="flex h-12 shrink-0 items-center bg-[#2a2d2e] px-4">
        <button
          className="min-w-0 flex-1 truncate text-left text-sm font-medium"
          onClick={() => size === "minimized" && setSize("normal")}
        >
          {name || "Nova campanha de e-mail"}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Minimizar compositor"
          onClick={() => setSize(size === "minimized" ? "normal" : "minimized")}
        >
          <Minimize2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 md:inline-flex"
          aria-label={size === "expanded" ? "Restaurar compositor" : "Expandir compositor"}
          onClick={() => setSize(size === "expanded" ? "normal" : "expanded")}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Fechar compositor" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {size !== "minimized" ? (
        <>
          <div className="flex shrink-0 border-b border-white/10 px-4 pt-2">
            {(["campaign", "individual"] as const).map((item) => (
              <button
                key={item}
                className={`border-b-2 px-3 py-2 text-xs font-medium ${
                  mode === item
                    ? "border-[#BEFA33] text-[#BEFA33]"
                    : "border-transparent text-zinc-500"
                }`}
                onClick={() => setMode(item)}
              >
                {item === "campaign" ? "Campanha" : "E-mail individual"}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {mode === "individual" ? (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <ShieldCheck className="h-8 w-8 text-zinc-500" />
                <h3 className="mt-4 font-medium">Envio individual indisponível</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                  O backend atual possui envio de teste administrativo, mas não um fluxo de produção para mensagens individuais. Esta modalidade será habilitada somente com autorização, auditoria e política de destinatários próprias.
                </p>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="divide-y divide-white/10 px-4">
                  <div className="flex items-center gap-3 py-2">
                    <Label className="w-14 shrink-0 text-xs text-zinc-500">De</Label>
                    <select
                      className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
                      value={providerId}
                      onChange={(event) => setProviderId(event.target.value)}
                    >
                      <option value="" className="bg-zinc-900">Selecione uma conta</option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id} className="bg-zinc-900">
                          {provider.name || provider.provider}
                          {provider.from_email ? ` · ${provider.from_email}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-start gap-3 py-2">
                    <Label className="mt-2 w-14 shrink-0 text-xs text-zinc-500">Para</Label>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {folders.map((folder) => {
                        const selected = selectedFolderIds.includes(folder.id);
                        return (
                          <button
                            key={folder.id}
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              selected
                                ? "border-[#BEFA33]/50 bg-[#BEFA33]/10 text-[#BEFA33]"
                                : "border-white/10 text-zinc-400 hover:border-white/25"
                            }`}
                            onClick={() =>
                              setSelectedFolderIds((current) =>
                                selected
                                  ? current.filter((id) => id !== folder.id)
                                  : [...current, folder.id],
                              )
                            }
                          >
                            {folder.name} ({folder.total})
                          </button>
                        );
                      })}
                      {!folders.length ? (
                        <span className="py-1 text-xs text-zinc-500">Nenhuma lista disponível</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="py-1">
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      placeholder="Nome interno da campanha"
                    />
                  </div>
                  <div className="py-1">
                    <Input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      placeholder="Assunto"
                    />
                  </div>
                </div>

                <EmailVisualEditor
                  html={bodyHtml}
                  subject={subject}
                  from={selectedProvider?.from_email || selectedProvider?.name || "Conta de e-mail"}
                  onChange={setBodyHtml}
                />
              </div>
            )}
          </div>

          {mode === "campaign" ? (
            <footer className="flex shrink-0 items-center gap-2 border-t border-white/10 px-4 py-3">
              <Button
                disabled={saving}
                className="bg-[#BEFA33] text-zinc-950 hover:bg-[#aee82f]"
                onClick={() => void saveDraft()}
              >
                {saving ? "Salvando..." : "Salvar rascunho"}
              </Button>
              <div className="ml-auto hidden text-right sm:block">
                <p className="text-xs text-zinc-400">{selectedCount} contatos selecionados</p>
                <p className="text-[10px] text-zinc-600">Elegibilidade confirmada ao salvar</p>
              </div>
            </footer>
          ) : null}
        </>
      ) : null}
      <span className="sr-only">Remetente atual: {selectedProvider?.from_email || "não definido"}</span>
    </section>
  );
}
