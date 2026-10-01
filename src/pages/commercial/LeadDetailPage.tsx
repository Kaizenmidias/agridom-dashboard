import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Edit,
  FileText,
  Globe,
  Loader2,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Save,
  Tag,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadLabelPicker } from "@/components/leads/LeadLabelPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_SECTORS, formatBRLInput } from "@/constants/lead-options";
import { getLeadWebsiteEnrichment, getLeadWebsitePerformance, getLeads, updateLeadDetails } from "@/services/leads/lead-service";
import { commercialEntitiesAPI, type UserOption } from "@/services/commercial-entities";
import type { Lead, LeadLabel } from "@/types/lead";
import { formatPhone } from "@/utils/phone";
import type { LeadWebsiteEnrichmentResponse, WebsiteEnrichmentDiagnostic } from "@/types/website-enrichment";
import type { LeadWebsitePerformanceResponse } from "@/types/pagespeed-performance";
import { formatPageSpeedCls, formatPageSpeedDate, formatPageSpeedMs, formatPageSpeedScore, pageSpeedFieldMessage, pageSpeedFieldSourceLabel, pageSpeedLabMetrics, pageSpeedStatusLabel, pageSpeedStatusMessage } from "@/services/leads/pagespeed-performance-presentation";
import { booleanLabel, buildCommercialSummary, cleanOpportunities, commercialOpportunities, friendlyOpportunity, headerLabel, imageAltLabel, isKnownStatus, pagesAnalyzedLabel, securityBooleanLabel, securityHeaders, statusLabel, technologyLabels, websiteAvailable } from "@/services/leads/website-enrichment-presentation";

const sourceLabels: Record<string, string> = {
  google_maps: "Google Maps",
  formulario: "Formulário",
  importacao: "Importação",
  indicacao: "Indicação",
  instagram: "Instagram",
  manual: "Manual",
  n8n: "n8n",
};

function getIdFromSlug(value = "") {
  return value.split("-").pop() || value;
}

export default function LeadDetailPage() {
  const { leadSlug } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [availableLabels, setAvailableLabels] = useState<LeadLabel[]>([]);
  const [details, setDetails] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    city: "",
    state: "",
    address: "",
    linkedin: "",
    sector: "",
    revenue: "",
    employees: "",
    budget: "",
    notes: "",
    nextMeetingAt: "",
    meetingOwner: "",
    documentName: "",
    documentUrl: "",
    assignedUserId: "unassigned",
  });
  const [labels, setLabels] = useState<LeadLabel[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityType, setActivityType] = useState<"task" | "call" | "follow_up" | "activity">("task");
  const [activityAssignee, setActivityAssignee] = useState("unassigned");
  const [activityDueAt, setActivityDueAt] = useState("");
  const [websiteEnrichment, setWebsiteEnrichment] = useState<LeadWebsiteEnrichmentResponse | null>(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState(false);
  const [websitePerformance, setWebsitePerformance] = useState<LeadWebsitePerformanceResponse | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState(false);

  const createActivity = async () => {
    if (!lead || !activityTitle.trim()) return;
    await commercialEntitiesAPI.createActivity(lead.id, {
      title: activityTitle.trim(),
      type: activityType,
      assigned_user_id: activityAssignee === "unassigned" ? null : Number(activityAssignee),
      due_at: activityDueAt ? new Date(activityDueAt).toISOString() : null,
    });
    const refreshed = await getLeads();
    setLead(refreshed.find((item) => item.id === lead.id) || lead);
    setActivityTitle("");
    setActivityDueAt("");
  };

  const completeActivity = async (activityId: string) => {
    if (!lead || !activityId.startsWith("activity-")) return;
    await commercialEntitiesAPI.updateActivity(Number(activityId.replace("activity-", "")), { status: "completed" });
    const refreshed = await getLeads();
    setLead(refreshed.find((item) => item.id === lead.id) || lead);
  };

  useEffect(() => {
    async function loadLead() {
      const id = getIdFromSlug(leadSlug);
      const [leads, usersPayload] = await Promise.all([
        getLeads(),
        commercialEntitiesAPI.getUsers().catch(() => ({ users: [] })),
      ]);
      const found = leads.find((item) => item.id === id) || null;
      setAvailableLabels(leads.flatMap((item) => item.metadata?.labels || []));
      setLead(found);
      setUserOptions(usersPayload.users);

      if (found) {
        setDetails({
          companyName: found.companyName || "",
          contactName: found.contactName || "",
          email: found.email || "",
          phone: formatPhone(found.phone),
          website: found.website || "",
          city: found.city || "",
          state: found.state || "",
          address: found.metadata?.address || "",
          linkedin: found.metadata?.linkedin || "",
          sector: found.metadata?.sector || found.category || "",
          revenue: found.metadata?.revenue || "",
          employees: found.metadata?.employees || "",
          budget: found.metadata?.budget || "",
          notes: found.metadata?.notes || "",
          nextMeetingAt: found.metadata?.nextMeetingAt ? found.metadata.nextMeetingAt.slice(0, 16) : "",
          meetingOwner: found.metadata?.meetingOwner || "",
          documentName: "",
          documentUrl: "",
          assignedUserId: found.assignedUserId ? String(found.assignedUserId) : "unassigned",
        });
        setLabels(found.metadata?.labels || []);
      }

      setLoading(false);
    }

    void loadLead();
  }, [leadSlug]);

  useEffect(() => {
    if (!lead?.id) return;
    if (!websiteAvailable(lead.website)) {
      setWebsiteEnrichment(null);
      setEnrichmentError(false);
      setEnrichmentLoading(false);
      return;
    }
    let active = true;
    setEnrichmentLoading(true);
    setEnrichmentError(false);
    void getLeadWebsiteEnrichment(lead.id).then((payload) => {
      if (active) setWebsiteEnrichment(payload);
    }).catch(() => {
      if (active) setEnrichmentError(true);
    }).finally(() => {
      if (active) setEnrichmentLoading(false);
    });
    return () => { active = false; };
  }, [lead?.id]);

  useEffect(() => {
    if (!lead?.id) return;
    if (!websiteAvailable(lead.website)) {
      setWebsitePerformance(null);
      setPerformanceError(false);
      setPerformanceLoading(false);
      return;
    }
    let active = true;
    setWebsitePerformance(null);
    setPerformanceLoading(true);
    setPerformanceError(false);
    void getLeadWebsitePerformance(lead.id).then((payload) => {
      if (active) setWebsitePerformance(payload);
    }).catch(() => {
      if (active) setPerformanceError(true);
    }).finally(() => {
      if (active) setPerformanceLoading(false);
    });
    return () => { active = false; };
  }, [lead?.id]);

  const documents = useMemo(() => lead?.metadata?.documents || [], [lead]);

  const saveLabels = async (nextLabels: LeadLabel[]) => {
    if (!lead) return;
    const previous = labels;
    setLabels(nextLabels);
    try {
      await commercialEntitiesAPI.setLeadLabels(lead.id, nextLabels.map((label) => label.id));
      setLead((current) => current ? { ...current, metadata: { ...current.metadata, labels: nextLabels } } : current);
    } catch (error) {
      setLabels(previous);
      throw error;
    }
  };

  const saveDetails = async (options?: { registerContact?: boolean; addDocument?: boolean }) => {
    if (!lead) return;
    setSaving(true);

    try {
      const nextDocuments = options?.addDocument && details.documentName.trim()
        ? [
            ...documents,
            {
              id: `doc-${Date.now()}`,
              name: details.documentName.trim(),
              url: details.documentUrl.trim() || null,
              createdAt: new Date().toISOString(),
            },
          ]
        : documents;

      const updated = await updateLeadDetails(lead.id, {
        ...lead,
        companyName: details.companyName || lead.companyName,
        contactName: details.contactName || null,
        email: details.email || null,
        phone: details.phone || null,
        website: details.website || null,
        city: details.city || null,
        state: details.state || null,
        category: details.sector || null,
        assignedUserId: details.assignedUserId === "unassigned" ? null : Number(details.assignedUserId),
        lastContactAt: options?.registerContact ? new Date().toISOString() : lead.lastContactAt,
        metadata: {
          ...lead.metadata,
          labels,
          address: details.address || null,
          linkedin: details.linkedin || null,
          sector: details.sector || null,
          revenue: details.revenue || null,
          employees: details.employees || null,
          budget: details.budget || null,
          notes: details.notes || null,
          nextMeetingAt: details.nextMeetingAt ? new Date(details.nextMeetingAt).toISOString() : null,
          meetingOwner: details.meetingOwner || null,
          documents: nextDocuments,
        },
      });

      setLead({ ...updated, metadata: { ...updated.metadata, labels, documents: nextDocuments } });
      setDetails((current) => ({ ...current, documentName: "", documentUrl: "" }));
      setEditingField(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando lead...</div>;
  }

  if (!lead) {
    return (
      <div className="p-6">
        <p className="font-medium">Lead não encontrado.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/comercial/leads")}>
          Voltar para Leads
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="border-b border-border/70 px-4 py-4 md:px-6">
        <Button asChild variant="ghost" className="mb-3 px-0">
          <Link to="/comercial/leads">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Leads
          </Link>
        </Button>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <EditableText
              name="companyName"
              value={details.companyName}
              editingField={editingField}
              setEditingField={setEditingField}
              onChange={(value) => setDetails({ ...details, companyName: value })}
              className="text-2xl font-semibold"
            />
            <p className="text-sm text-muted-foreground">
              {details.contactName || "Contato não informado"} · {sourceLabels[lead.source] || lead.source}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => <Badge key={label.id} className="border-0 text-white" style={{ backgroundColor: label.color }}>{label.name}</Badge>)}
            <Badge variant="outline">Score {lead.score || 0}</Badge>
            <Badge variant="outline">{lead.folderName || "Sem pasta"}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <Card className="rounded-lg shadow-none">
            <CardHeader><CardTitle className="text-base">Tracking do lead</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <Info icon={Tag} label="Origem" value={sourceLabels[lead.source] || lead.source} />
              <Info icon={CalendarDays} label="Entrada" value={new Date(lead.createdAt).toLocaleString("pt-BR")} />
              <Info icon={Phone} label="Último contato" value={lead.lastContactAt ? new Date(lead.lastContactAt).toLocaleString("pt-BR") : "Ainda não contatado"} />
              <Info icon={Users} label="Responsável" value={lead.assignedTo || "Sem responsável"} />
            </CardContent>
          </Card>

          <WebsiteEnrichmentCard
            website={lead.website}
            response={websiteEnrichment}
            loading={enrichmentLoading}
            error={enrichmentError}
            performance={websitePerformance}
            performanceLoading={performanceLoading}
            performanceError={performanceError}
          />

          <Card className="rounded-lg shadow-none">
            <CardHeader><CardTitle className="text-base">Dados comerciais</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select value={details.sector || undefined} onValueChange={(value) => setDetails({ ...details, sector: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SECTORS.map((sector) => <SelectItem key={sector} value={sector}>{sector}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Receita estimada" value={details.revenue} onChange={(value) => setDetails({ ...details, revenue: formatBRLInput(value) })} />
              <Field label="Número de funcionários" value={details.employees} onChange={(value) => setDetails({ ...details, employees: value.replace(/\D/g, "") })} />
              <Field label="Valor do orçamento" value={details.budget} onChange={(value) => setDetails({ ...details, budget: formatBRLInput(value) })} />
              <Field label="LinkedIn" value={details.linkedin} onChange={(value) => setDetails({ ...details, linkedin: value })} />
              <div className="space-y-2 md:col-span-3">
                <Label>Endereço</Label>
                <Input value={details.address} onChange={(event) => setDetails({ ...details, address: event.target.value })} placeholder="Rua, número, bairro, cidade" />
              </div>
              <div className="space-y-3 md:col-span-3">
                <Label>Etiquetas</Label>
                <LeadLabelPicker labels={labels} availableLabels={availableLabels} onChange={(next) => void saveLabels(next)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Responsável</Label>
                <Select value={details.assignedUserId} onValueChange={(value) => setDetails({ ...details, assignedUserId: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sem responsável</SelectItem>
                    {userOptions.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name} ({user.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-none">
            <CardHeader><CardTitle className="text-base">Anotações</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={details.notes}
                onChange={(event) => setDetails({ ...details, notes: event.target.value })}
                placeholder="Registre dores, objeções, próximos passos e contexto do relacionamento."
                className="min-h-32"
              />
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-none">
            <CardHeader><CardTitle className="text-base">Histórico de atividade</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 rounded-md border p-3 md:grid-cols-[150px_minmax(180px,1fr)_minmax(180px,1fr)_190px_auto]">
                <Select value={activityType} onValueChange={(value) => setActivityType(value as typeof activityType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="task">Tarefa</SelectItem><SelectItem value="call">Ligação</SelectItem><SelectItem value="follow_up">Follow-up</SelectItem><SelectItem value="activity">Atividade</SelectItem></SelectContent>
                </Select>
                <Input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Título da atividade" />
                <Select value={activityAssignee} onValueChange={setActivityAssignee}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sem responsável</SelectItem>
                    {userOptions.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={activityDueAt} onChange={(event) => setActivityDueAt(event.target.value)} />
                <Button onClick={() => void createActivity()} disabled={!activityTitle.trim()}>Criar</Button>
              </div>
              {(lead.activities || []).length ? lead.activities!.map((activity) => (
                <div key={activity.id} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline">{activity.channel}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(activity.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                  {activity.subject ? <p className="mt-2 text-sm font-medium">{activity.subject}</p> : null}
                  <p className="mt-2 text-sm text-muted-foreground">{activity.message}</p>
                  {activity.assignedUserName ? <p className="mt-1 text-xs text-muted-foreground">Responsável: {activity.assignedUserName}</p> : null}
                  {activity.dueAt ? <p className="mt-1 text-xs text-muted-foreground">Prazo: {new Date(activity.dueAt).toLocaleString("pt-BR")}</p> : null}
                  {activity.recipient ? <p className="mt-1 text-xs text-muted-foreground">Destino: {activity.recipient}</p> : null}
                  {activity.status === "pending" ? <Button size="sm" variant="outline" className="mt-3" onClick={() => void completeActivity(activity.id)}>Concluir</Button> : null}
                </div>
              )) : <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>}
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-5">
          <Card className="rounded-lg shadow-none">
            <CardHeader><CardTitle className="text-base">Contato</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <EditableContact icon={Users} name="contactName" label="Nome" value={details.contactName} editingField={editingField} setEditingField={setEditingField} onChange={(value) => setDetails({ ...details, contactName: value })} />
              <EditableContact icon={Mail} name="email" label="E-mail" value={details.email} editingField={editingField} setEditingField={setEditingField} onChange={(value) => setDetails({ ...details, email: value })} />
              <EditableContact icon={Phone} name="phone" label="Telefone" value={details.phone} editingField={editingField} setEditingField={setEditingField} onChange={(value) => setDetails({ ...details, phone: value })} />
              <EditableContact icon={Globe} name="website" label="Site" value={details.website} editingField={editingField} setEditingField={setEditingField} onChange={(value) => setDetails({ ...details, website: value })} />
              <EditableContact icon={Linkedin} name="linkedin" label="LinkedIn" value={details.linkedin} editingField={editingField} setEditingField={setEditingField} onChange={(value) => setDetails({ ...details, linkedin: value })} />
              <EditableContact icon={MapPin} name="address" label="Endereço" value={details.address || [details.city, details.state].filter(Boolean).join(" / ")} editingField={editingField} setEditingField={setEditingField} onChange={(value) => setDetails({ ...details, address: value })} />
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-none">
            <CardHeader><CardTitle className="text-base">Agendador de reunião</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field type="datetime-local" label="Próxima reunião" value={details.nextMeetingAt} onChange={(value) => setDetails({ ...details, nextMeetingAt: value })} />
              <Field label="Responsável pela reunião" value={details.meetingOwner} onChange={(value) => setDetails({ ...details, meetingOwner: value })} />
              <Button className="w-full" onClick={() => void saveDetails({ registerContact: true })}>
                Registrar contato feito
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-none">
            <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {documents.map((doc) => (
                <a key={doc.id} href={doc.url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted">
                  <FileText className="h-4 w-4 text-primary" />
                  {doc.name}
                </a>
              ))}
              <Input value={details.documentName} onChange={(event) => setDetails({ ...details, documentName: event.target.value })} placeholder="Nome do documento" />
              <Input value={details.documentUrl} onChange={(event) => setDetails({ ...details, documentUrl: event.target.value })} placeholder="Link do documento" />
              <Button variant="outline" className="w-full" onClick={() => void saveDetails({ addDocument: true })}>
                Adicionar documento
              </Button>
            </CardContent>
          </Card>

          <Button className="w-full" onClick={() => void saveDetails()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar informações"}
          </Button>
        </aside>
      </div>
    </div>
  );
}

function WebsiteEnrichmentCard({ website, response, loading, error, performance, performanceLoading, performanceError }: { website?: string | null; response: LeadWebsiteEnrichmentResponse | null; loading: boolean; error: boolean; performance: LeadWebsitePerformanceResponse | null; performanceLoading: boolean; performanceError: boolean }) {
  const enrichment = response?.enrichment;
  const diagnostic = enrichment?.diagnostic;
  const status = enrichment?.status;
  const knownStatus = isKnownStatus(status);
  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div><CardTitle className="text-base">Resumo Comercial</CardTitle><p className="mt-1 text-sm text-muted-foreground">Pré-diagnóstico do site</p></div>
        {status ? <Badge variant="outline">{statusLabel(status)}</Badge> : null}
      </CardHeader>
      <CardContent>
        <>{loading ? <EnrichmentMessage><Loader2 className="h-4 w-4 animate-spin" />Carregando pré-diagnóstico...</EnrichmentMessage> : error ? <EnrichmentMessage>Não foi possível carregar o pré-diagnóstico no momento.</EnrichmentMessage> : !websiteAvailable(website) ? <EnrichmentMessage>Este lead ainda não possui um site cadastrado para análise.</EnrichmentMessage> : !enrichment ? <EnrichmentMessage>Este site ainda não possui um pré-diagnóstico disponível.</EnrichmentMessage> : !knownStatus ? <EnrichmentMessage>Status do pré-diagnóstico indisponível.</EnrichmentMessage> : status === "pending" ? <EnrichmentMessage>Pré-diagnóstico aguardando processamento.</EnrichmentMessage> : status === "processing" ? <EnrichmentMessage>Pré-diagnóstico em andamento.</EnrichmentMessage> : status === "failed" ? <EnrichmentMessage>Não foi possível concluir o pré-diagnóstico deste site.</EnrichmentMessage> : !diagnostic ? <EnrichmentMessage>{status === "partial" ? "Análise parcialmente concluída, mas não há dados disponíveis para exibição." : "O pré-diagnóstico foi concluído, mas não há dados disponíveis para exibição."}</EnrichmentMessage> : <div className="space-y-5">
          {status === "partial" ? <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">Análise parcialmente concluída.</p> : null}
          <DiagnosticGroup title="Resumo do site"><div className="space-y-2 text-sm leading-6 text-muted-foreground">{buildCommercialSummary(diagnostic).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></DiagnosticGroup>
          <DiagnosticGroup title="Principais oportunidades">{commercialOpportunities(diagnostic).length ? <div className="grid gap-2 sm:grid-cols-2">{commercialOpportunities(diagnostic).map((item) => <div key={item} className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"><span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />{item}</div>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma oportunidade adicional foi destacada nesta análise.</p>}</DiagnosticGroup>
          <DiagnosticGroup title="Tecnologia"><DetectedList values={technologyLabels(diagnostic.technology)} empty="Nenhuma das tecnologias monitoradas foi detectada nas páginas analisadas." /></DiagnosticGroup>
          <DiagnosticGroup title="Marketing"><BooleanGrid values={[['Google Analytics', diagnostic.marketing?.googleAnalytics], ['Google Tag Manager', diagnostic.marketing?.googleTagManager], ['WhatsApp', diagnostic.marketing?.whatsapp], ['Instagram', diagnostic.marketing?.instagram], ['LinkedIn', diagnostic.marketing?.linkedin], ['Meta Pixel', diagnostic.marketing?.metaPixel]]} /></DiagnosticGroup>
          <DiagnosticGroup title="SEO"><BooleanGrid values={[['Título', diagnostic.seo?.titlePresent], ['Meta descrição', diagnostic.seo?.metaDescriptionPresent], ['Canonical', diagnostic.seo?.canonical], ['Dados estruturados', diagnostic.seo?.structuredData], ['Open Graph', diagnostic.seo?.openGraph]]} /><p className="mt-3 text-sm text-muted-foreground">{imageAltLabel(diagnostic.seo?.imagesWithoutAlt)}</p></DiagnosticGroup>
          <DiagnosticGroup title="Experiência e conversão"><BooleanGrid values={[['Compatibilidade mobile', diagnostic.mobile?.viewport], ['Formulário de contato', diagnostic.marketing?.contactForm], ['Telefone clicável', diagnostic.marketing?.clickablePhone], ['E-mail clicável', diagnostic.marketing?.clickableEmail]]} /></DiagnosticGroup>
          <DiagnosticGroup title="Segurança"><SecurityGrid diagnostic={diagnostic} /></DiagnosticGroup>
          {cleanOpportunities(diagnostic.opportunities).length ? <DiagnosticGroup title="Oportunidades identificadas"><ul className="list-disc space-y-1 pl-5 text-sm">{cleanOpportunities(diagnostic.opportunities).map((item) => <li key={item}>{friendlyOpportunity(item)}</li>)}</ul></DiagnosticGroup> : null}
          {pagesAnalyzedLabel(diagnostic.pagesAnalyzed) ? <p className="border-t pt-3 text-xs text-muted-foreground">{pagesAnalyzedLabel(diagnostic.pagesAnalyzed)}</p> : null}
        </div>}<PageSpeedSection website={website} performance={performance?.performance || null} loading={performanceLoading} error={performanceError} /></>
      </CardContent>
    </Card>
  );
}

function PageSpeedSection({ website, performance, loading, error }: { website?: string | null; performance: LeadWebsitePerformanceResponse["performance"]; loading: boolean; error: boolean }) {
  const message = pageSpeedStatusMessage(performance?.status);
  const analyzedAt = formatPageSpeedDate(performance?.analyzedAt);
  return <DiagnosticGroup title="Performance"><div className="space-y-3 rounded-md border bg-muted/10 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Performance do site</p><p className="text-xs text-muted-foreground">PageSpeed / Lighthouse</p></div>{performance?.status ? <Badge variant="outline">{pageSpeedStatusLabel(performance.status)}</Badge> : null}</div>{loading ? <EnrichmentMessage><Loader2 className="h-4 w-4 animate-spin" />Carregando análise de performance...</EnrichmentMessage> : error ? <EnrichmentMessage>Não foi possível carregar a performance do site no momento.</EnrichmentMessage> : !websiteAvailable(website) ? <EnrichmentMessage>Este lead não possui um site cadastrado para análise.</EnrichmentMessage> : !performance ? <EnrichmentMessage>Ainda não há análise de performance disponível.</EnrichmentMessage> : message ? <EnrichmentMessage>{message}</EnrichmentMessage> : <div className="space-y-4"><div className="flex items-center gap-3"><span className={`text-2xl font-semibold ${performance.score === null ? "text-muted-foreground" : performance.score >= 90 ? "text-emerald-500" : performance.score >= 50 ? "text-amber-500" : "text-destructive"}`}>{formatPageSpeedScore(performance.score)}</span><span className="text-xs text-muted-foreground">Score mobile Lighthouse</span></div>{performance.lab && pageSpeedLabMetrics(performance.lab).length ? <div><p className="mb-2 text-xs font-medium text-muted-foreground">Métricas Lab</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{pageSpeedLabMetrics(performance.lab).map(([label, value]) => <div key={label} className="rounded-md border px-2 py-2"><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div>)}</div></div> : null}<div><p className="mb-2 text-xs font-medium text-muted-foreground">Dados de usuários reais <span className="font-normal">(CrUX)</span></p>{performance.field?.available ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-md border px-2 py-2"><p className="text-xs text-muted-foreground">LCP</p><p className="text-sm font-medium">{formatPageSpeedMs(performance.field.lcpMs)}</p></div><div className="rounded-md border px-2 py-2"><p className="text-xs text-muted-foreground">INP</p><p className="text-sm font-medium">{formatPageSpeedMs(performance.field.inpMs)}</p></div><div className="rounded-md border px-2 py-2"><p className="text-xs text-muted-foreground">CLS</p><p className="text-sm font-medium">{formatPageSpeedCls(performance.field.cls)}</p></div><p className="col-span-full text-xs text-muted-foreground">{pageSpeedFieldSourceLabel(performance.field.source)}</p></div> : <p className="text-xs text-muted-foreground">{pageSpeedFieldMessage(performance.field)}</p>}</div>{analyzedAt ? <p className="text-xs text-muted-foreground">Analisado em {analyzedAt}</p> : null}</div>}</div></DiagnosticGroup>;
}

function EnrichmentMessage({ children }: { children: ReactNode }) { return <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">{children}</div>; }
function DiagnosticGroup({ title, children }: { title: string; children: ReactNode }) { return <section><h3 className="mb-2 text-sm font-semibold">{title}</h3>{children}</section>; }
function BooleanGrid({ values, headers = false }: { values: Array<[string, boolean | null | undefined] | [string, string | null | undefined]>; headers?: boolean }) { return <div className="grid gap-2 sm:grid-cols-2">{values.map(([label, value]) => { const message = headers ? headerLabel(value as string | null | undefined) : booleanLabel(value as boolean | null | undefined); const tone = headers ? (value === undefined ? "bg-muted-foreground" : value === null ? "bg-destructive" : "bg-emerald-500") : value === true ? "bg-emerald-500" : value === false ? "bg-destructive" : "bg-muted-foreground"; return <div key={label} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"><span>{label}</span><span title={message} aria-label={message} className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} /></div>; })}</div>; }
function SecurityGrid({ diagnostic }: { diagnostic: WebsiteEnrichmentDiagnostic }) { const rows: Array<[string, string, string]> = [["HTTPS", securityBooleanLabel("https", diagnostic.security?.https), diagnostic.security?.https === true ? "bg-emerald-500" : diagnostic.security?.https === false ? "bg-destructive" : "bg-muted-foreground"], ["Conteúdo misto", securityBooleanLabel("mixedContent", diagnostic.security?.mixedContent), diagnostic.security?.mixedContent === false ? "bg-emerald-500" : diagnostic.security?.mixedContent === true ? "bg-destructive" : "bg-muted-foreground"], ...securityHeaders(diagnostic).map(([label, value]) => [label, headerLabel(value), value === undefined || value?.trim() === "" ? "bg-muted-foreground" : value === null ? "bg-destructive" : "bg-emerald-500"] as [string, string, string])]; return <div className="grid gap-2 sm:grid-cols-2">{rows.map(([label, message, tone]) => <div key={label} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"><span>{label}</span><span title={message} aria-label={message} className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} /></div>)}</div>; }
function DetectedList({ values, empty }: { values: string[]; empty: string }) { return values.length ? <div className="flex flex-wrap gap-2">{values.map((value) => <Badge key={value} variant="secondary"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{value}</Badge>)}</div> : <p className="text-sm text-muted-foreground">{empty}</p>; }

function Info({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <Icon className="mb-2 h-4 w-4 text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function EditableText({
  name,
  value,
  editingField,
  setEditingField,
  onChange,
  className,
}: {
  name: string;
  value: string;
  editingField: string | null;
  setEditingField: (value: string | null) => void;
  onChange: (value: string) => void;
  className?: string;
}) {
  if (editingField === name) {
    return <Input autoFocus value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => setEditingField(null)} className="max-w-xl" />;
  }

  return (
    <div className="group inline-flex items-center gap-2">
      <h1 className={className}>{value || "Não informado"}</h1>
      <button type="button" onClick={() => setEditingField(name)} className="opacity-0 transition group-hover:opacity-100">
        <Edit className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function EditableContact({
  icon: Icon,
  name,
  label,
  value,
  editingField,
  setEditingField,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>;
  name: string;
  label: string;
  value: string;
  editingField: string | null;
  setEditingField: (value: string | null) => void;
  onChange: (value: string) => void;
}) {
  if (editingField === name) {
    return (
      <div className="space-y-1">
        <Label>{label}</Label>
        <Input autoFocus value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => setEditingField(null)} />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 break-all">{value || `${label} não informado`}</span>
      <button type="button" onClick={() => setEditingField(name)} className="opacity-0 transition group-hover:opacity-100">
        <Edit className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
