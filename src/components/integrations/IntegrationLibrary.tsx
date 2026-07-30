import { useEffect, useState } from "react";
import { Building2, CheckCircle2, KeyRound, Loader2, Plug, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { prospectingAPI } from "@/api/prospecting";
import type { IntegrationProvider, IntegrationSummary } from "@/types/prospecting";

const providerIcons: Record<IntegrationProvider, typeof Plug> = {
  apify: Plug,
  casa_dos_dados: Building2,
  whatsapp_validator: ShieldCheck,
};

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
  if (status === "connected" || status === "configured") return "bg-green-100 text-green-800";
  if (status === "auth_error" || status === "provider_error") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

export function IntegrationLibrary() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<IntegrationProvider | null>(null);
  const [items, setItems] = useState<IntegrationSummary[]>([]);
  const [activeIntegration, setActiveIntegration] = useState<IntegrationSummary | null>(null);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const data = await prospectingAPI.getIntegrations();
      setItems(data.integrations);
    } catch (error) {
      toast({
        title: "Erro ao carregar integracoes",
        description: error instanceof Error ? error.message : "Nao foi possivel carregar a biblioteca.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIntegrations();
  }, []);

  const testIntegration = async (provider: IntegrationProvider) => {
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <AppBreadcrumbs />
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Integracoes</h1>
            <p className="text-muted-foreground">Biblioteca segura de provedores usados pelos modulos comerciais.</p>
          </div>
          <Button variant="outline" onClick={() => void loadIntegrations()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />Atualizar
          </Button>
        </div>
      </div>

      <Alert>
        <KeyRound className="h-4 w-4" />
        <AlertTitle>Credenciais ficam no backend</AlertTitle>
        <AlertDescription>
          Tokens e API Keys devem ser configurados como variaveis de ambiente seguras. Esta tela mostra status, metadados e segredos mascarados, sem armazenar credenciais no navegador.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = providerIcons[item.provider];
            return (
              <Card key={item.provider} className="rounded-lg border shadow-none">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge className={getStatusClass(item.status)}>{getStatusLabel(item.status)}</Badge>
                  </div>
                  <div>
                    <CardTitle>{item.displayName}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                    {item.tokenMasked ? <p>Token: {item.tokenMasked}</p> : null}
                    {item.apiKeyMasked ? <p>API Key: {item.apiKeyMasked}</p> : null}
                    {item.creditsBalance != null ? <p>Creditos: {item.creditsBalance}</p> : null}
                    <p>Ultima validacao: {item.lastTestedAt ? new Date(item.lastTestedAt).toLocaleString("pt-BR") : "Nunca"}</p>
                    {item.lastError ? <p className="text-destructive">{item.lastError}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setActiveIntegration(item)}>Configurar</Button>
                    <Button variant="outline" onClick={() => void testIntegration(item.provider)} disabled={testing === item.provider}>
                      {testing === item.provider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Testar conexao
                    </Button>
                    <Button variant="outline" disabled>
                      <WifiOff className="mr-2 h-4 w-4" />Desconectar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(activeIntegration)} onOpenChange={(open) => !open && setActiveIntegration(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeIntegration?.displayName}</DialogTitle>
            <DialogDescription>
              Configure os campos nao sensiveis aqui. Segredos devem ser cadastrados nas variaveis de ambiente do backend.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {activeIntegration?.provider === "apify" ? (
              <>
                <div className="space-y-2">
                  <Label>API Token</Label>
                  <Input value={activeIntegration.tokenMasked || "Configure APIFY_TOKEN no backend"} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Actor ID do Google Maps</Label>
                  <Input value={String(activeIntegration.metadata.googleMapsActorId || "APIFY_GOOGLE_MAPS_ACTOR")} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Actor ID do Instagram</Label>
                  <Input value={String(activeIntegration.metadata.instagramActorId || "APIFY_INSTAGRAM_ACTOR")} disabled />
                </div>
              </>
            ) : null}
            {activeIntegration?.provider === "casa_dos_dados" ? (
              <>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input value={activeIntegration.apiKeyMasked || "Configure CASA_DOS_DADOS_API_KEY no backend"} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Versao da API</Label>
                  <Input value={String(activeIntegration.metadata.apiVersion || "v5")} disabled />
                </div>
                <div className="space-y-2">
                  <Label>URL base</Label>
                  <Input value={String(activeIntegration.metadata.baseUrl || "https://api.casadosdados.com.br")} disabled />
                </div>
              </>
            ) : null}
            {activeIntegration?.provider === "whatsapp_validator" ? (
              <>
                <div className="space-y-2">
                  <Label>Provedor</Label>
                  <Input value={String(activeIntegration.metadata.provider || "Nao configurado")} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Validade do cache</Label>
                  <Input value={`${String(activeIntegration.metadata.cacheDays || 30)} dias`} disabled />
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setActiveIntegration(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
