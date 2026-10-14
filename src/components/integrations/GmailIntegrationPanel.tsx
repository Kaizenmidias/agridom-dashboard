import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Mail, RefreshCw, Send, Unplug } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { gmailIntegrationsAPI } from "@/api/gmail-integrations";
import type { GmailConnection, GmailConnectionStatus } from "@/types/prospecting";

const statusLabels: Record<GmailConnectionStatus, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando",
  connected: "Conectado",
  reconnect_required: "Requer reconexão",
  error: "Erro",
};

const OAUTH_POLL_INTERVAL_MS = 3000;
const OAUTH_POLL_TIMEOUT_MS = 10 * 60 * 1000;

function validateAuthorizationUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== "https://accounts.google.com" || url.pathname !== "/o/oauth2/v2/auth" || url.username || url.password) {
    throw new Error("O endereço de autorização do Google não é válido.");
  }
  return url.toString();
}

function statusClass(status: GmailConnectionStatus) {
  if (status === "connected") return "bg-emerald-100 text-emerald-800";
  if (status === "error") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

export function GmailIntegrationPanel() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [connection, setConnection] = useState<GmailConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testForm, setTestForm] = useState({ to: "", subject: "", message: "" });
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const pollBusyRef = useRef(false);
  const pollStartedAtRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const loadStatus = useCallback(async () => {
    try {
      if (!mountedRef.current) return null;
      setError(null);
      const result = await gmailIntegrationsAPI.getStatus();
      if (!mountedRef.current) return null;
      setConnection(result.connection);
      return result.connection;
    } catch (cause) {
      if (!mountedRef.current) return null;
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar o Gmail.");
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadStatus();
    const onFocus = () => void loadStatus();
    const onOAuthMessage = (event: MessageEvent<{ type?: string; status?: string }>) => {
      if (event.origin !== window.location.origin || event.source !== popupRef.current || event.data?.type !== "kaizen:gmail-oauth") return;
      stopPolling();
      void loadStatus();
      if (event.data.status === "connected") toast({ title: "Gmail conectado", description: "A conta foi autorizada com sucesso." });
      else if (event.data.status === "cancelled") toast({ title: "Autorização cancelada", description: "A conexão Gmail anterior foi preservada." });
      else toast({ title: "Falha na autorização Gmail", description: "A conexão anterior foi preservada. Tente novamente.", variant: "destructive" });
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("message", onOAuthMessage);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("message", onOAuthMessage);
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      pollStartedAtRef.current = null;
      popupRef.current = null;
    };
  }, [loadStatus]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    pollStartedAtRef.current = null;
    popupRef.current = null;
  }, []);

  const beginOAuth = async (reconnect = false) => {
    if (busy) return;
    try {
      setBusy("connect");
      const result = reconnect ? await gmailIntegrationsAPI.reconnect() : await gmailIntegrationsAPI.start();
      const authorizationUrl = validateAuthorizationUrl(result.authorizationUrl);
      const popup = window.open(authorizationUrl, "kaizen-gmail-oauth", "popup,width=560,height=720,resizable=yes,scrollbars=yes");
      if (!popup) throw new Error("O navegador bloqueou a nova guia. Permita pop-ups para conectar o Gmail.");
      popupRef.current = popup;
      setConnection((current) => current ? { ...current, status: "connecting" } : current);
      stopPolling();
      popupRef.current = popup;
      pollStartedAtRef.current = Date.now();
      pollRef.current = window.setInterval(() => {
        if (pollBusyRef.current) return;
        if (Date.now() - (pollStartedAtRef.current || Date.now()) >= OAUTH_POLL_TIMEOUT_MS) {
          stopPolling();
          toast({ title: "Autorização pendente", description: "O acompanhamento expirou. A tentativa OAuth não foi cancelada pelo navegador; consulte o status antes de tentar novamente.", variant: "destructive" });
          void loadStatus();
          return;
        }
        if (popup.closed) {
          stopPolling();
          void loadStatus();
        } else {
          pollBusyRef.current = true;
          void loadStatus().then((current) => {
            if (current?.status === "connected") stopPolling();
          }).finally(() => { pollBusyRef.current = false; });
        }
      }, OAUTH_POLL_INTERVAL_MS);
    } catch (cause) {
      toast({ title: "Não foi possível iniciar o Gmail", description: cause instanceof Error ? cause.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    try {
      setBusy("disconnect");
      const result = await gmailIntegrationsAPI.disconnect();
      await loadStatus();
      toast({ title: "Gmail desconectado", description: result.revocationConfirmed ? "A conexão local e a revogação no Google foram confirmadas." : "A conexão foi desativada no CRM, mas a revogação no Google não pôde ser confirmada.", variant: result.revocationConfirmed ? "default" : "destructive" });
    } catch (cause) {
      toast({ title: "Não foi possível desconectar", description: cause instanceof Error ? cause.message : "A conexão local não foi alterada.", variant: "destructive" });
    } finally {
      setBusy(null);
      setConfirmOpen(false);
    }
  };

  const sendTest = async () => {
    if (testSending) return;
    try {
      setTestSending(true);
      await gmailIntegrationsAPI.sendTest(testForm);
      setTestOpen(false);
      setTestForm({ to: "", subject: "", message: "" });
      toast({ title: "E-mail de teste enviado", description: "O Gmail confirmou o envio da mensagem." });
    } catch (cause) {
      toast({ title: "Não foi possível enviar", description: cause instanceof Error ? cause.message : "Verifique a conexão Gmail e tente novamente.", variant: "destructive" });
    } finally {
      setTestSending(false);
    }
  };

  if (!isAdmin) return null;

  const status = connection?.status || "disconnected";
  const connecting = busy === "connect" || status === "connecting";

  return (
    <Card className="rounded-lg border shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary"><Mail className="h-5 w-5" /></div>
          <Badge className={statusClass(status)}>{statusLabels[status]}</Badge>
        </div>
        <div><CardTitle>Gmail</CardTitle><CardDescription>Envio de e-mails pela conta Gmail comercial compartilhada.</CardDescription></div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <Alert variant="destructive"><AlertTitle>Falha ao consultar o Gmail</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>{connection?.emailAddress ? `Conta: ${connection.emailAddress}` : "Nenhuma conta Gmail conectada"}</p>
          {connection?.displayName ? <p>Nome: {connection.displayName}</p> : null}
          {connection?.lastErrorCode ? <p className="text-destructive">Código: {connection.lastErrorCode}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void beginOAuth(status === "reconnect_required" || status === "error")} disabled={loading || Boolean(busy) || connecting}>
            {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : status === "reconnect_required" || status === "error" ? <RefreshCw className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}
            {status === "reconnect_required" || status === "error" ? "Reconectar Gmail" : "Conectar Gmail"}
          </Button>
          {status === "connected" ? <Button variant="outline" onClick={() => setConfirmOpen(true)} disabled={Boolean(busy)}><Unplug className="mr-2 h-4 w-4" />Desconectar</Button> : null}
          {status === "connected" ? <Button variant="outline" onClick={() => setTestOpen(true)} disabled={Boolean(busy) || testSending}><Send className="mr-2 h-4 w-4" />Enviar e-mail de teste</Button> : null}
          <Button variant="ghost" size="icon" onClick={() => void loadStatus()} disabled={loading || Boolean(busy)} aria-label="Atualizar status do Gmail" title="Atualizar status do Gmail"><CheckCircle2 className="h-4 w-4" /></Button>
        </div>
        {status === "connecting" ? <p className="text-xs text-muted-foreground">Aguardando a conclusão da autorização em outra guia.</p> : null}
        {loading ? <p className="text-xs text-muted-foreground">Consultando status...</p> : null}
      </CardContent>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent><DialogHeader><DialogTitle>Desconectar Gmail?</DialogTitle><DialogDescription>{connection?.emailAddress ? `A conta ${connection.emailAddress} será desativada no CRM.` : "A conta Gmail será desativada no CRM."} A revogação no Google será informada separadamente.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={() => void disconnect()} disabled={busy === "disconnect"}>{busy === "disconnect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Desconectar</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar e-mail de teste</DialogTitle><DialogDescription>O envio usará exclusivamente a conta Gmail conectada.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>De</Label><Input value={connection?.emailAddress || ""} readOnly /></div>
            <div className="space-y-2"><Label htmlFor="gmail-test-to">Para</Label><Input id="gmail-test-to" type="email" value={testForm.to} onChange={(event) => setTestForm((current) => ({ ...current, to: event.target.value }))} maxLength={320} /></div>
            <div className="space-y-2"><Label htmlFor="gmail-test-subject">Assunto</Label><Input id="gmail-test-subject" value={testForm.subject} onChange={(event) => setTestForm((current) => ({ ...current, subject: event.target.value }))} maxLength={200} /></div>
            <div className="space-y-2"><Label htmlFor="gmail-test-message">Mensagem</Label><Textarea id="gmail-test-message" value={testForm.message} onChange={(event) => setTestForm((current) => ({ ...current, message: event.target.value }))} maxLength={10000} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTestOpen(false)} disabled={testSending}>Cancelar</Button><Button onClick={() => void sendTest()} disabled={testSending || !testForm.to.trim() || !testForm.subject.trim() || !testForm.message.trim()}>{testSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar e-mail</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
