import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, Plus, Power, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { whatsappAPI, type WhatsAppAccount } from "@/api/whatsapp";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const statusLabel: Record<string, string> = { pending: "Pendente", qr_required: "Aguardando QR Code", connecting: "Conectando", connected: "Conectado", disconnected: "Desconectado", error: "Erro", archived: "Arquivado" };
const statusClass = (status: string) => status === "connected" ? "bg-emerald-100 text-emerald-800" : status === "error" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";

export function WhatsAppIntegrationPanel() {
  const { toast } = useToast();
  const [config, setConfig] = useState({ baseUrl: "", apiKey: "", timeout: "15000" });
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedConfig, setSavedConfig] = useState({ configured: false, apiKeyMasked: "" });
  const [name, setName] = useState("");
  const [autoCreateLeads, setAutoCreateLeads] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAccount, setQrAccount] = useState<WhatsAppAccount | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [busyAccount, setBusyAccount] = useState<number | null>(null);

  const load = async () => {
    try {
      const [saved, listed] = await Promise.all([whatsappAPI.getConfig(), whatsappAPI.listAccounts()]);
      setConfig({ baseUrl: saved.metadata.baseUrl || "", apiKey: "", timeout: String(saved.metadata.timeout || 15000) });
      setSavedConfig({ configured: saved.configured, apiKeyMasked: saved.metadata.apiKeyMasked || "" });
      setAccounts(listed.accounts);
    } catch (error) { toast({ title: "Falha ao carregar WhatsApp", description: error instanceof Error ? error.message : "Nao foi possivel carregar a integracao.", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const connected = useMemo(() => accounts.filter((item) => item.status === "connected").length, [accounts]);
  const refreshAccount = async (account: WhatsAppAccount) => { try { const result = await whatsappAPI.getStatus(account.id); setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status: result.status } : item)); } catch {} };
  useEffect(() => {
    if (!qrOpen || !qrAccount) return undefined;
    const timer = window.setInterval(() => { void refreshAccount(qrAccount); }, 4000);
    return () => window.clearInterval(timer);
  }, [qrOpen, qrAccount]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await whatsappAPI.saveConfig({ baseUrl: config.baseUrl, apiKey: config.apiKey || undefined, timeout: Number(config.timeout) || 15000 });
      setConfig((current) => ({ ...current, apiKey: "" }));
      setSavedConfig({ configured: saved.configured, apiKeyMasked: saved.metadata.apiKeyMasked || "" });
      toast({ title: "Configuração salva", description: "A Evolution API foi configurada com segurança." });
    } catch (error) {
      toast({ title: "Falha ao salvar", description: error instanceof Error ? error.message : "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  const test = async () => { try { const result = await whatsappAPI.testConnection(); toast({ title: "Conexao validada", description: result.message }); } catch (error) { toast({ title: "Falha na conexao", description: error instanceof Error ? error.message : "Nao foi possivel testar.", variant: "destructive" }); } };
  const syncWebhook = async (account: WhatsAppAccount) => { setBusyAccount(account.id); try { await whatsappAPI.syncWebhook(account.id); toast({ title: "Webhook sincronizado", description: `A instância ${account.name} agora envia eventos autenticados ao CRM.` }); } catch (error) { toast({ title: "Falha ao sincronizar webhook", description: error instanceof Error ? error.message : "Nao foi possivel sincronizar o webhook.", variant: "destructive" }); } finally { setBusyAccount(null); } };
  const create = async () => { if (!name.trim()) return; setBusyAccount(-1); try { const result = await whatsappAPI.createAccount({ name: name.trim(), autoCreateLeads }); setAccounts((current) => [...current, result.account]); setName(""); setConnectOpen(false); await openQr(result.account); } catch (error) { toast({ title: "Falha ao conectar numero", description: error instanceof Error ? error.message : "Nao foi possivel criar a instancia.", variant: "destructive" }); } finally { setBusyAccount(null); } };
  const openQr = async (account: WhatsAppAccount) => { setQrAccount(account); setQrOpen(true); setQrCode(null); try { const result = await whatsappAPI.getQr(account.id); setQrCode(result.qrCode || null); setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status: "qr_required" } : item)); } catch (error) { toast({ title: "Falha ao gerar QR Code", description: error instanceof Error ? error.message : "Nao foi possivel gerar o QR Code.", variant: "destructive" }); } };
  const disconnect = async (account: WhatsAppAccount) => { if (!window.confirm(`Desconectar ${account.name}? O historico sera preservado.`)) return; setBusyAccount(account.id); try { await whatsappAPI.disconnect(account.id); setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status: "disconnected" } : item)); } catch (error) { toast({ title: "Falha ao desconectar", description: error instanceof Error ? error.message : "Nao foi possivel desconectar.", variant: "destructive" }); } finally { setBusyAccount(null); } };
  const archive = async (account: WhatsAppAccount) => { if (!window.confirm(`Arquivar ${account.name}? O historico sera preservado.`)) return; setBusyAccount(account.id); try { await whatsappAPI.archive(account.id); setAccounts((current) => current.filter((item) => item.id !== account.id)); } catch (error) { toast({ title: "Falha ao arquivar", description: error instanceof Error ? error.message : "Nao foi possivel arquivar.", variant: "destructive" }); } finally { setBusyAccount(null); } };

  return <Card className="rounded-lg border shadow-none lg:col-span-2 xl:col-span-4">
    <CardHeader className="flex flex-row items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500"><MessageCircle className="h-5 w-5" /></div><div><CardTitle>WhatsApp</CardTitle><CardDescription>Conecte numeros pela Evolution API para usar conversas e automacoes.</CardDescription></div></div><Badge className="bg-emerald-100 text-emerald-800">{connected} conectado(s) / {accounts.length}</Badge></CardHeader>
    <CardContent className="space-y-5">{savedConfig.configured ? <Alert className="border-emerald-500/30 bg-emerald-500/5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><AlertTitle>Configuração salva com sucesso</AlertTitle><AlertDescription>A API Key está configurada e protegida no servidor{savedConfig.apiKeyMasked ? ` (${savedConfig.apiKeyMasked})` : ""}. O campo permanece vazio por segurança.</AlertDescription></Alert> : null}<div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]"><div className="space-y-2"><Label>Base URL</Label><Input value={config.baseUrl} onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://evolution.seudominio.com" /></div><div className="space-y-2"><Label>API Key</Label><Input value={config.apiKey} onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))} placeholder="Deixe vazio para manter" type="password" /></div><div className="space-y-2"><Label>Timeout (ms)</Label><Input value={config.timeout} onChange={(event) => setConfig((current) => ({ ...current, timeout: event.target.value }))} type="number" min={3000} /></div><div className="flex items-end gap-2"><Button variant="outline" onClick={() => void test()} disabled={!config.baseUrl}><CheckCircle2 className="mr-2 h-4 w-4" />Testar</Button><Button onClick={() => void save()} disabled={saving || !config.baseUrl}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button></div></div>
      <div className="flex items-center justify-between border-t pt-4"><div><p className="font-medium">Numeros conectados</p><p className="text-sm text-muted-foreground">Cada conexao possui sua propria instancia e historico.</p></div><Button onClick={() => setConnectOpen(true)}><Plus className="mr-2 h-4 w-4" />Conectar numero</Button></div>
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div> : accounts.length === 0 ? <Alert><AlertTitle>Nenhum numero conectado</AlertTitle><AlertDescription>Configure a Evolution API e conecte o primeiro numero WhatsApp.</AlertDescription></Alert> : <div className="grid gap-3 md:grid-cols-2">{accounts.map((account) => <div key={account.id} className="flex items-center justify-between gap-3 rounded-md border p-4"><div className="min-w-0"><p className="truncate font-medium">{account.name}</p><p className="text-sm text-muted-foreground">{account.phoneNumber || "Numero ainda nao identificado"}</p><Badge className={statusClass(account.status)}>{statusLabel[account.status] || account.status}</Badge></div><div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" title="Sincronizar webhook" onClick={() => void syncWebhook(account)} disabled={busyAccount === account.id}><RefreshCw className="h-4 w-4" /></Button>{account.status !== "connected" ? <Button size="icon" variant="ghost" title="Exibir QR Code" onClick={() => void openQr(account)}><QrCode className="h-4 w-4" /></Button> : <Button size="icon" variant="ghost" title="Desconectar" onClick={() => void disconnect(account)} disabled={busyAccount === account.id}><Power className="h-4 w-4" /></Button>}<Button size="icon" variant="ghost" title="Arquivar" onClick={() => void archive(account)} disabled={busyAccount === account.id}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}
    </CardContent>
    <Dialog open={connectOpen} onOpenChange={setConnectOpen}><DialogContent><DialogHeader><DialogTitle>Conectar numero WhatsApp</DialogTitle><DialogDescription>Escolha um nome para identificar esta conta no CRM.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Nome da conexao</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Kaizen Comercial" /></div><div className="flex items-center justify-between rounded-md border p-3"><div><p className="font-medium">Criar Lead automaticamente</p><p className="text-xs text-muted-foreground">Novos contatos recebidos viram Leads com origem WhatsApp.</p></div><Switch checked={autoCreateLeads} onCheckedChange={setAutoCreateLeads} /></div></div><DialogFooter><Button variant="outline" onClick={() => setConnectOpen(false)}>Cancelar</Button><Button onClick={() => void create()} disabled={!name.trim() || busyAccount === -1}>Continuar</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={qrOpen} onOpenChange={setQrOpen}><DialogContent><DialogHeader><DialogTitle>{qrAccount?.name || "WhatsApp"}</DialogTitle><DialogDescription>Escaneie o QR Code com o WhatsApp. O status sera atualizado automaticamente.</DialogDescription></DialogHeader><div className="flex min-h-[280px] flex-col items-center justify-center gap-4">{qrCode ? <img className="h-64 w-64 rounded-md border bg-white p-2" src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code para conectar o WhatsApp" /> : <Loader2 className="h-8 w-8 animate-spin" />}<p className="text-sm text-muted-foreground">{qrAccount ? statusLabel[accounts.find((item) => item.id === qrAccount.id)?.status || "qr_required"] : "Aguardando..."}</p></div><DialogFooter><Button variant="outline" onClick={() => qrAccount && void openQr(qrAccount)}><QrCode className="mr-2 h-4 w-4" />Gerar novo QR</Button><Button onClick={() => setQrOpen(false)}>Fechar</Button></DialogFooter></DialogContent></Dialog>
  </Card>;
}
