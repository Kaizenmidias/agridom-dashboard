import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  DollarSign,
  FileText,
  Globe,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLeads, updateLeadDetails } from "@/services/leads/lead-service";
import type { Lead } from "@/types/lead";
import { formatPhone } from "@/utils/phone";

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

function labelsToText(value?: string[]) {
  return (value || []).join(", ");
}

function textToLabels(value: string) {
  return value.split(",").map((label) => label.trim()).filter(Boolean);
}

export default function LeadDetailPage() {
  const { leadSlug } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState({
    labels: "",
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
  });

  useEffect(() => {
    async function loadLead() {
      const id = getIdFromSlug(leadSlug);
      const leads = await getLeads();
      const found = leads.find((item) => item.id === id) || null;
      setLead(found);

      if (found) {
        setDetails({
          labels: labelsToText(found.metadata?.labels),
          address: found.metadata?.address || "",
          linkedin: found.metadata?.linkedin || "",
          sector: found.metadata?.sector || "",
          revenue: found.metadata?.revenue || "",
          employees: found.metadata?.employees || "",
          budget: found.metadata?.budget || "",
          notes: found.metadata?.notes || "",
          nextMeetingAt: found.metadata?.nextMeetingAt ? found.metadata.nextMeetingAt.slice(0, 16) : "",
          meetingOwner: found.metadata?.meetingOwner || "",
          documentName: "",
          documentUrl: "",
        });
      }

      setLoading(false);
    }

    void loadLead();
  }, [leadSlug]);

  const documents = useMemo(() => lead?.metadata?.documents || [], [lead]);

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
        lastContactAt: options?.registerContact ? new Date().toISOString() : lead.lastContactAt,
        metadata: {
          ...lead.metadata,
          labels: textToLabels(details.labels),
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

      setLead({ ...updated, metadata: { ...updated.metadata, documents: nextDocuments } });
      setDetails((current) => ({ ...current, documentName: "", documentUrl: "" }));
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

  const labelList = textToLabels(details.labels);

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
            <h1 className="text-2xl font-semibold">{lead.companyName}</h1>
            <p className="text-sm text-muted-foreground">
              {lead.contactName || "Contato não informado"} · {sourceLabels[lead.source] || lead.source}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {labelList.map((label) => <Badge key={label} variant="secondary">{label}</Badge>)}
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

          <Card className="rounded-lg shadow-none">
            <CardHeader><CardTitle className="text-base">Dados comerciais</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field label="Setor" value={details.sector} onChange={(value) => setDetails({ ...details, sector: value })} />
              <Field label="Receita estimada" value={details.revenue} onChange={(value) => setDetails({ ...details, revenue: value })} />
              <Field label="Número de funcionários" value={details.employees} onChange={(value) => setDetails({ ...details, employees: value })} />
              <Field icon={DollarSign} label="Valor do orçamento" value={details.budget} onChange={(value) => setDetails({ ...details, budget: value })} />
              <Field label="LinkedIn" value={details.linkedin} onChange={(value) => setDetails({ ...details, linkedin: value })} />
              <Field label="Etiquetas" value={details.labels} onChange={(value) => setDetails({ ...details, labels: value })} placeholder="Cliente ideal, quente, agência" />
              <div className="space-y-2 md:col-span-3">
                <Label>Endereço</Label>
                <Input value={details.address} onChange={(event) => setDetails({ ...details, address: event.target.value })} placeholder="Rua, número, bairro, cidade" />
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
              {(lead.activities || []).length ? lead.activities!.map((activity) => (
                <div key={activity.id} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline">{activity.channel}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(activity.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                  {activity.subject ? <p className="mt-2 text-sm font-medium">{activity.subject}</p> : null}
                  <p className="mt-2 text-sm text-muted-foreground">{activity.message}</p>
                  {activity.recipient ? <p className="mt-1 text-xs text-muted-foreground">Destino: {activity.recipient}</p> : null}
                </div>
              )) : <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>}
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-5">
          <Card className="rounded-lg shadow-none">
            <CardHeader><CardTitle className="text-base">Contato</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Contact icon={Building2} value={lead.companyName} />
              <Contact icon={Mail} value={lead.email || "E-mail não informado"} />
              <Contact icon={Phone} value={formatPhone(lead.phone)} />
              <Contact icon={Globe} value={lead.website || "Site não informado"} />
              <Contact icon={Linkedin} value={details.linkedin || "LinkedIn não informado"} />
              <Contact icon={MapPin} value={details.address || [lead.city, lead.state].filter(Boolean).join(" / ") || "Endereço não informado"} />
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

function Info({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <Icon className="mb-2 h-4 w-4 text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /> : null}
        <Input className={Icon ? "pl-9" : undefined} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

function Contact({ icon: Icon, value }: { icon: ComponentType<{ className?: string }>; value: string }) {
  return (
    <p className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="break-all">{value}</span>
    </p>
  );
}
