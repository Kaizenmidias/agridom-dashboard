import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, FileText, Inbox, Mail, Plus, Search, Send, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { broadcastAPI, type Campaign } from "@/api/broadcast-campaigns";

type Section = "campaigns" | "drafts" | "scheduled" | "sent" | "suppression" | "compose";

const statusLabel: Record<string, string> = { draft: "Rascunho", scheduled: "Agendada", running: "Em andamento", paused: "Pausada", completed: "ConcluÃ­da", failed: "Falhou" };

export default function EmailMarketingPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [providers, setProviders] = useState<Array<{ id: number | string; provider?: string; name?: string; from_email?: string; status: string }>>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [campaignResult, providerResult] = await Promise.all([broadcastAPI.list(), broadcastAPI.emailProviders()]);
      setCampaigns(campaignResult.campaigns || []);
      setProviders(providerResult.providers || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel carregar o E-mail Marketing."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => campaigns.filter((item) => {
    const matchesSearch = !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase());
    if (section === "drafts") return matchesSearch && item.status === "draft";
    if (section === "scheduled") return matchesSearch && item.status === "scheduled";
    if (section === "sent") return matchesSearch && ["completed", "failed"].includes(item.status);
    return matchesSearch;
  }), [campaigns, search, section]);

  const saveDraft = async () => {
    if (!name.trim() || !providerId || !subject.trim() || !body.trim()) { toast.error("Preencha remetente, nome, assunto e conteÃºdo."); return; }
    setSaving(true);
    try {
      const created = await broadcastAPI.create({ name: name.trim(), channels: ["email"], email_provider: providerId === "gmail" ? "gmail" : "smtp", email_provider_id: providerId === "gmail" ? null : Number(providerId) });
      await broadcastAPI.content(created.campaign.id, { content_type: "text", email_subject: subject.trim(), email_body_text: body.trim(), email_html: body.trim() });
      toast.success("Rascunho salvo.");
      setName(""); setSubject(""); setBody("");
      await load();
      setSection("drafts");
    } catch (error) { toast.error(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel salvar o rascunho."); }
    finally { setSaving(false); }
  };

  return <div className="min-h-full bg-background px-4 py-6 md:px-8">
    <AppBreadcrumbs />
    <div className="mt-5 flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-xl border bg-card/40 lg:flex-row">
      <aside className="w-full border-b p-4 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-2 pb-5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary"><Mail className="h-5 w-5" /></span><div><p className="font-semibold">E-mail Marketing</p><p className="text-xs text-muted-foreground">Campanhas e contatos</p></div></div>
        <Button className="mb-4 w-full justify-start gap-2" onClick={() => setSection("compose")}><Plus className="h-4 w-4" /> Escrever campanha</Button>
        <nav className="grid gap-1 text-sm">
          {([["campaigns", "Campanhas", Send], ["drafts", "Rascunhos", FileText], ["scheduled", "Agendados", Archive], ["sent", "Enviados", Send], ["suppression", "Descadastros / preferÃªncias", Settings2]] as const).map(([key, label, Icon]) => <button key={key} className={`flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${section === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setSection(key)}><Icon className="h-4 w-4" />{label}</button>)}
          <div className="mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground/50" title="Leitura Gmail ainda nÃ£o estÃ¡ implementada"><Inbox className="h-4 w-4" /> Caixa de entrada <Badge variant="outline" className="ml-auto text-[10px]">Em breve</Badge></div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-5 md:p-7">
        {section === "compose" ? <Card className="mx-auto max-w-3xl"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Nova campanha de e-mail</CardTitle><p className="mt-1 text-sm text-muted-foreground">O rascunho serÃ¡ submetido Ã s regras de consentimento e supressÃ£o antes do envio.</p></div><Button variant="ghost" size="icon" onClick={() => setSection("campaigns")}><X className="h-4 w-4" /></Button></CardHeader><CardContent className="grid gap-5"><div className="grid gap-2"><Label htmlFor="email-campaign-name">Nome interno</Label><Input id="email-campaign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Newsletter de outubro" /></div><div className="grid gap-2"><Label htmlFor="email-campaign-provider">De</Label><select id="email-campaign-provider" className="h-10 rounded-md border bg-background px-3" value={providerId} onChange={(e) => setProviderId(e.target.value)}><option value="">Selecione uma conta</option>{providers.map((item) => <option key={item.id} value={item.id}>{item.name || item.provider} {item.from_email ? `Â· ${item.from_email}` : ""}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="email-campaign-subject">Assunto</Label><Input id="email-campaign-subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></div><div className="grid gap-2"><Label htmlFor="email-campaign-body">ConteÃºdo</Label><Textarea id="email-campaign-body" className="min-h-48" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva o conteÃºdo da campanha..." /></div><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setSection("campaigns")}>Cancelar</Button><Button disabled={saving} onClick={() => void saveDraft()}>{saving ? "Salvando..." : "Salvar rascunho"}</Button></div></CardContent></Card> : <><div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h1 className="text-2xl font-semibold">{section === "suppression" ? "Descadastros e preferÃªncias" : "Campanhas de e-mail"}</h1><p className="mt-1 text-sm text-muted-foreground">Gmail e SMTP com fila controlada, consentimento e histÃ³rico.</p></div><Button onClick={() => setSection("compose")}><Plus className="mr-2 h-4 w-4" /> Nova campanha</Button></div>{section === "suppression" ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Consulte o status de comunicaÃ§Ã£o individualmente em Comercial â†’ Leads. Descadastros sÃ£o preservados e nÃ£o sÃ£o removidos por ediÃ§Ãµes comuns.</CardContent></Card> : <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-lg">{section === "campaigns" ? "Todas as campanhas" : statusLabel[section] || "Campanhas"}</CardTitle><div className="relative w-full max-w-xs"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar campanhas" value={search} onChange={(e) => setSearch(e.target.value)} /></div></CardHeader><CardContent>{loading ? <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p> : filtered.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma campanha encontrada.</p> : <div className="divide-y">{filtered.map((item) => <button key={item.id} className="flex w-full items-center justify-between gap-4 py-4 text-left hover:bg-muted/30" onClick={() => navigate(`/comercial/disparar/${item.id}`)}><div className="min-w-0"><p className="truncate font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.total || 0} destinatÃ¡rios Â· {item.sent || 0} enviados Â· {item.failed || 0} falhas</p></div><Badge variant="outline">{statusLabel[item.status] || item.status}</Badge></button>)}</div>}</CardContent></Card>}</>}</main>
    </div>
  </div>;
}
