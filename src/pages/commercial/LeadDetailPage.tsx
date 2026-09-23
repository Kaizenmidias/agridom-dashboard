import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Edit,
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
import { LeadLabelPicker } from "@/components/leads/LeadLabelPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_SECTORS, formatBRLInput } from "@/constants/lead-options";
import { getLeads, updateLeadDetails } from "@/services/leads/lead-service";
import type { Lead, LeadLabel } from "@/types/lead";
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
  });
  const [labels, setLabels] = useState<LeadLabel[]>([]);

  useEffect(() => {
    async function loadLead() {
      const id = getIdFromSlug(leadSlug);
      const leads = await getLeads();
      const found = leads.find((item) => item.id === id) || null;
      setAvailableLabels(leads.flatMap((item) => item.metadata?.labels || []));
      setLead(found);

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
        });
        setLabels(found.metadata?.labels || []);
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
        companyName: details.companyName || lead.companyName,
        contactName: details.contactName || null,
        email: details.email || null,
        phone: details.phone || null,
        website: details.website || null,
        city: details.city || null,
        state: details.state || null,
        category: details.sector || null,
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
                <LeadLabelPicker labels={labels} availableLabels={availableLabels} onChange={setLabels} />
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
