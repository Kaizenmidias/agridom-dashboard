import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Plug,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { prospectingAPI } from "@/api/prospecting";
import type { IntegrationProvider, IntegrationSummary } from "@/types/prospecting";

type IntegrationDraft = {
  apifyToken: string;
  apifyGoogleMapsActorId: string;
  apifyInstagramActorId: string;
  apifyTimeoutMinutes: string;
  apifyPollIntervalSeconds: string;
  casaApiKey: string;
  casaBaseUrl: string;
  casaApiVersion: string;
  whatsappBaseUrl: string;
  whatsappApiKey: string;
  whatsappInstanceName: string;
  whatsappCacheDays: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
};

type FieldType = "text" | "password" | "number" | "switch";

type FieldConfig = {
  key: keyof IntegrationDraft;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  span?: "full" | "half";
  min?: number;
};

type IntegrationCardConfig = {
  provider: IntegrationProvider;
  title: string;
  description: string;
  icon: LucideIcon;
  fields: FieldConfig[];
  summaryLines: (summary: IntegrationSummary) => string[];
};

const fieldSets: Record<IntegrationProvider, FieldConfig[]> = {
  apify: [
    { key: "apifyToken", label: "API Token", type: "password", placeholder: "Cole o token do Apify", span: "full" },
    { key: "apifyGoogleMapsActorId", label: "Actor do Google Maps", type: "text", placeholder: "username/actor-google-maps", span: "full" },
    { key: "apifyInstagramActorId", label: "Actor do Instagram", type: "text", placeholder: "username/actor-instagram", span: "full" },
    { key: "apifyTimeoutMinutes", label: "Timeout", type: "number", placeholder: "10", span: "half", min: 1 },
    { key: "apifyPollIntervalSeconds", label: "Intervalo", type: "number", placeholder: "5", span: "half", min: 1 },
  ],
  casa_dos_dados: [
    { key: "casaApiKey", label: "API Key", type: "password", placeholder: "Cole a chave da Casa dos Dados", span: "full" },
    { key: "casaBaseUrl", label: "URL base", type: "text", placeholder: "https://api.casadosdados.com.br", span: "full" },
    { key: "casaApiVersion", label: "Versao da API", type: "text", placeholder: "v5", span: "half" },
  ],
  whatsapp_validator: [
    { key: "whatsappBaseUrl", label: "URL base", type: "text", placeholder: "https://evolution.sua-instancia.com", span: "full" },
    { key: "whatsappApiKey", label: "API Key", type: "password", placeholder: "Chave da Evolution API", span: "full" },
    { key: "whatsappInstanceName", label: "Instancia", type: "text", placeholder: "kaizen-validation", span: "half" },
    { key: "whatsappCacheDays", label: "Cache em dias", type: "number", placeholder: "30", span: "half", min: 1 },
  ],
  smtp: [
    { key: "smtpHost", label: "Servidor SMTP", type: "text", placeholder: "smtp.seudominio.com", span: "full" },
    { key: "smtpPort", label: "Porta", type: "number", placeholder: "587", span: "half", min: 1 },
    { key: "smtpSecure", label: "SSL/TLS", type: "switch", span: "half" },
    { key: "smtpUser", label: "Usuario", type: "text", placeholder: "noreply@seudominio.com", span: "full" },
    { key: "smtpPass", label: "Senha", type: "password", placeholder: "Senha SMTP", span: "full" },
    { key: "smtpFrom", label: "Remetente", type: "text", placeholder: "Kaizen <noreply@seudominio.com>", span: "full" },
  ],
};

const integrationCards: IntegrationCardConfig[] = [
  {
    provider: "apify",
    title: "Apify",
    description: "Scrapers utilizados na prospeccao comercial.",
    icon: Plug,
    fields: fieldSets.apify,
    summaryLines: (summary) => [
      summary.tokenMasked ? `Token: ${summary.tokenMasked}` : "Token nao configurado",
      `Google Maps: ${String(summary.metadata.googleMapsActorId || "Nao configurado")}`,
      `Instagram: ${String(summary.metadata.instagramActorId || "Nao configurado")}`,
    ],
  },
  {
    provider: "casa_dos_dados",
    title: "Casa dos Dados",
    description: "Consulta de dados empresariais por CNAE e localidade.",
    icon: Building2,
    fields: fieldSets.casa_dos_dados,
    summaryLines: (summary) => [
      summary.apiKeyMasked ? `API Key: ${summary.apiKeyMasked}` : "API Key nao configurada",
      `Base URL: ${String(summary.metadata.baseUrl || "Nao configurada")}`,
      `Versao: ${String(summary.metadata.apiVersion || "v5")}`,
    ],
  },
  {
    provider: "whatsapp_validator",
    title: "Evolution API",
    description: "Valida telefone WhatsApp com a Evolution API.",
    icon: ShieldCheck,
    fields: fieldSets.whatsapp_validator,
    summaryLines: (summary) => [
      summary.apiKeyMasked ? `API Key: ${summary.apiKeyMasked}` : "API Key nao configurada",
      `URL base: ${String(summary.metadata.baseUrl || "Nao configurada")}`,
      `Instancia: ${String(summary.metadata.instanceName || "Nao configurada")}`,
    ],
  },
  {
    provider: "smtp",
    title: "SMTP",
    description: "Envio de emails pelo backend.",
    icon: Mail,
    fields: fieldSets.smtp,
    summaryLines: (summary) => [
      `Host: ${String(summary.metadata.host || "Nao configurado")}`,
      `Porta: ${String(summary.metadata.port || 587)}`,
      `Remetente: ${String(summary.metadata.from || "Nao configurado")}`,
    ],
  },
];

function getStatusLabel(status: IntegrationSummary["status"]) {
  const labels = {
    not_configured: "Nao configurada",
    configured: "Configurada",
    connected: "Conectada",
    auth_error: "Erro de autenticacao",
    provider_error: "Erro do provedor",
  };
  return labels[status];
}

function getStatusClass(status: IntegrationSummary["status"]) {
  if (status === "connected" || status === "configured") return "bg-emerald-100 text-emerald-800";
  if (status === "auth_error" || status === "provider_error") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function readMetadataValue(summary: IntegrationSummary | null, key: string, fallback = "") {
  const value = summary?.metadata?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
}

function buildDraft(summary: IntegrationSummary | null): IntegrationDraft {
  return {
    apifyToken: "",
    apifyGoogleMapsActorId: readMetadataValue(summary, "googleMapsActorId"),
    apifyInstagramActorId: readMetadataValue(summary, "instagramActorId"),
    apifyTimeoutMinutes: readMetadataValue(summary, "timeoutMinutes", "10"),
    apifyPollIntervalSeconds: readMetadataValue(summary, "pollIntervalSeconds", "5"),
    casaApiKey: "",
    casaBaseUrl: readMetadataValue(summary, "baseUrl", "https://api.casadosdados.com.br"),
    casaApiVersion: readMetadataValue(summary, "apiVersion", "v5"),
    whatsappBaseUrl: readMetadataValue(summary, "baseUrl"),
    whatsappApiKey: "",
    whatsappInstanceName: readMetadataValue(summary, "instanceName"),
    whatsappCacheDays: readMetadataValue(summary, "cacheDays", "30"),
    smtpHost: readMetadataValue(summary, "host"),
    smtpPort: readMetadataValue(summary, "port", "587"),
    smtpSecure: Boolean(summary?.secure),
    smtpUser: readMetadataValue(summary, "user"),
    smtpPass: "",
    smtpFrom: readMetadataValue(summary, "from"),
  };
}

function buildPayload(provider: IntegrationProvider, draft: IntegrationDraft) {
  if (provider === "apify") {
    return {
      token: draft.apifyToken,
      googleMapsActorId: draft.apifyGoogleMapsActorId,
      instagramActorId: draft.apifyInstagramActorId,
      timeoutMinutes: Number(draft.apifyTimeoutMinutes || 10),
      pollIntervalSeconds: Number(draft.apifyPollIntervalSeconds || 5),
    };
  }

  if (provider === "casa_dos_dados") {
    return {
      apiKey: draft.casaApiKey,
      baseUrl: draft.casaBaseUrl,
      apiVersion: draft.casaApiVersion,
    };
  }

  if (provider === "whatsapp_validator") {
    return {
      baseUrl: draft.whatsappBaseUrl,
      apiKey: draft.whatsappApiKey,
      instanceName: draft.whatsappInstanceName,
      cacheDays: Number(draft.whatsappCacheDays || 30),
    };
  }

  return {
    host: draft.smtpHost,
    port: Number(draft.smtpPort || 587),
    secure: draft.smtpSecure,
    user: draft.smtpUser,
    pass: draft.smtpPass,
    from: draft.smtpFrom,
  };
}

export function IntegrationLibrary() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<IntegrationProvider | null>(null);
  const [items, setItems] = useState<IntegrationSummary[]>([]);
  const [activeIntegration, setActiveIntegration] = useState<IntegrationSummary | null>(null);
  const [draft, setDraft] = useState<IntegrationDraft | null>(null);

  const activeConfig = useMemo(
    () => integrationCards.find((item) => item.provider === activeIntegration?.provider) || null,
    [activeIntegration?.provider]
  );

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await prospectingAPI.getIntegrations();
      setItems(data.integrations);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel carregar a biblioteca.";
      setLoadError(message);
      toast({
        title: "Erro ao carregar integracoes",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIntegrations();
  }, []);

  const openIntegration = (summary: IntegrationSummary) => {
    setActiveIntegration(summary);
    setDraft(buildDraft(summary));
  };

  const closeDialog = () => {
    setActiveIntegration(null);
    setDraft(null);
  };

  const handleSave = async (testAfterSave = false) => {
    if (!activeIntegration || !draft) return null;

    try {
      setSaving(true);
      const payload = buildPayload(activeIntegration.provider, draft);
      const updated = await prospectingAPI.saveIntegrationMetadata(activeIntegration.provider, payload);
      setItems((current) => current.map((item) => (item.provider === updated.provider ? updated : item)));
      setActiveIntegration(updated);
      setDraft(buildDraft(updated));
      toast({
        title: "Integracao salva",
        description: "Os dados foram gravados no backend e aplicados ao runtime.",
      });

      if (testAfterSave) {
        setTesting(updated.provider);
        try {
          const result = await prospectingAPI.testIntegration(updated.provider);
          toast({ title: "Teste concluido", description: result.message });
          await loadIntegrations();
        } catch (error) {
          toast({
            title: "Falha no teste",
            description: error instanceof Error ? error.message : "Nao foi possivel testar a integracao.",
            variant: "destructive",
          });
        } finally {
          setTesting(null);
        }
      }

      return updated;
    } catch (error) {
      toast({
        title: "Erro ao salvar integracao",
        description: error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes.",
        variant: "destructive",
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (provider: IntegrationProvider) => {
    try {
      setTesting(provider);
      const result = await prospectingAPI.testIntegration(provider);
      toast({ title: "Teste concluido", description: result.message });
      await loadIntegrations();
    } catch (error) {
      toast({
        title: "Falha no teste",
        description: error instanceof Error ? error.message : "Nao foi possivel testar a integracao.",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const itemsByProvider = useMemo(
    () => new Map(items.map((item) => [item.provider, item] as const)),
    [items]
  );

  const renderField = (field: FieldConfig) => {
    if (!draft || !activeIntegration) return null;

    if (field.type === "switch") {
      return (
        <div key={String(field.key)} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
          <div className="space-y-1">
            <Label>{field.label}</Label>
            {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
          </div>
          <Switch
            checked={Boolean(draft[field.key])}
            onCheckedChange={(checked) =>
              setDraft((current) => (current ? ({ ...current, [field.key]: checked } as IntegrationDraft) : current))
            }
          />
        </div>
      );
    }

    return (
      <div key={String(field.key)} className={field.span === "full" ? "space-y-2 md:col-span-2" : "space-y-2"}>
        <Label>{field.label}</Label>
        <Input
          type={field.type}
          placeholder={field.placeholder}
          min={field.min}
          value={String(draft[field.key] ?? "")}
          onChange={(event) =>
            setDraft((current) =>
              current
                ? ({ ...current, [field.key]: event.target.value } as IntegrationDraft)
                : current
            )
          }
        />
        {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <AppBreadcrumbs />
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Integracoes</h1>
            <p className="text-muted-foreground">Central de configuracao das credenciais utilizadas pelos modulos comerciais.</p>
          </div>
          <Button variant="outline" onClick={() => void loadIntegrations()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <Alert>
        <Settings2 className="h-4 w-4" />
        <AlertTitle>Configuracao persistida no backend</AlertTitle>
        <AlertDescription>
          Os dados informados nos modais sao gravados no Supabase e tambem aplicados ao runtime do servidor para manter os testes e os modulos ativos.
        </AlertDescription>
      </Alert>

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar dados salvos</AlertTitle>
          <AlertDescription>
            {loadError}. Os modais continuam disponiveis com a estrutura padrao para que a integracao possa ser ajustada manualmente.
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {integrationCards.map((card) => {
            const item = itemsByProvider.get(card.provider) ?? {
              provider: card.provider,
              displayName: card.title,
              description: card.description,
              status: "not_configured",
              configured: false,
              connected: false,
              metadata: {},
            } as IntegrationSummary;
            const Icon = card.icon;

            return (
              <Card key={card.provider} className="rounded-lg border shadow-none">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge className={getStatusClass(item.status)}>{getStatusLabel(item.status)}</Badge>
                  </div>
                  <div>
                    <CardTitle>{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                    {card.summaryLines(item).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    <p>Ultimo teste: {item.lastTestedAt ? new Date(item.lastTestedAt).toLocaleString("pt-BR") : "Nunca"}</p>
                    {item.lastError ? <p className="text-destructive">{item.lastError}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openIntegration(item)}>
                      Configurar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleTest(item.provider)}
                      disabled={testing === item.provider}
                    >
                      {testing === item.provider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Testar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(activeIntegration)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-hidden">
          {activeIntegration && activeConfig && draft ? (
            <>
              <DialogHeader>
                <DialogTitle>{activeConfig.title}</DialogTitle>
                <DialogDescription>{activeConfig.description}</DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-3">
                <div className="grid gap-4 md:grid-cols-2">
                  {activeConfig.fields.map((field) => renderField(field))}
                </div>
              </ScrollArea>

              <Separator />

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => void handleSave(true)}
                  disabled={saving || testing === activeIntegration.provider}
                >
                  {saving || testing === activeIntegration.provider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar e testar
                </Button>
                <Button onClick={() => void handleSave(false)} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default IntegrationLibrary;
