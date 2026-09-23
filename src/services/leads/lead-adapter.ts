import type { Lead, LeadLabel, LeadSource, LeadStatus } from "@/types/lead";
import type { Prospect, ProspectStatus } from "@/types/database";
import { buildWhatsAppUrl } from "@/utils/whatsapp";
import { slugify } from "@/utils/lead-formatters";

type ProspectAnalysisReport = {
  folderName?: string | null;
  source?: string | null;
  origem?: string | null;
  contactName?: string | null;
  email_secundario?: string | null;
  bairro?: string | null;
  crmSent?: boolean;
  crmSentAt?: string | null;
  address?: string | null;
  linkedin?: string | null;
  sector?: string | null;
  revenue?: string | null;
  employees?: string | null;
  budget?: string | null;
  notes?: string | null;
  nextMeetingAt?: string | null;
  meetingOwner?: string | null;
  documents?: Lead["metadata"]["documents"];
};

const statusMap: Record<ProspectStatus, LeadStatus> = {
  Novo: "novo",
  "Contato Enviado": "em_contato",
  Respondeu: "em_contato",
  Interessado: "qualificado",
  "Reunião Agendada": "reuniao",
  "Proposta Enviada": "proposta",
  Fechado: "convertido",
  Perdido: "perdido",
};

function normalizeLabels(labels?: Array<string | LeadLabel | { id: number | string; name: string; color: string }>): LeadLabel[] {
  if (!Array.isArray(labels)) return [];

  return labels
    .map((label) => {
      if (typeof label === "string") {
        return { id: slugify(label), name: label, color: "#4D6EDB" };
      }

      if (!label?.name) return null;
      return {
        id: String(label.id || slugify(label.name)),
        name: label.name,
        color: label.color || "#4D6EDB",
      };
    })
    .filter((label): label is LeadLabel => Boolean(label));
}

function mapSource(value?: string | null): LeadSource {
  const normalized = slugify(value || "");

  if (normalized.includes("google")) return "google_maps";
  if (normalized.includes("form")) return "formulario";
  if (normalized.includes("import")) return "importacao";
  if (normalized.includes("indic")) return "indicacao";
  if (normalized.includes("instagram")) return "instagram";
  if (normalized.includes("n8n")) return "n8n";

  return "manual";
}

export function prospectToLead(prospect: Prospect): Lead {
  let report: ProspectAnalysisReport = {};
  if (typeof prospect.analysis_report === "string") {
    try { report = JSON.parse(prospect.analysis_report || "{}"); } catch { report = {}; }
  } else report = (prospect.analysis_report || {}) as ProspectAnalysisReport;
  const folderName = report.folderName || (prospect.website_exists ? "Qualificados" : "Sem Site");
  const source = mapSource(report.source || report.origem || "google_maps");

  return {
    id: String(prospect.id),
    companyName: prospect.business_name,
    contactName: report.contactName || null,
    category: prospect.category,
    phone: prospect.phone,
    whatsapp: buildWhatsAppUrl(prospect.phone),
    email: prospect.email,
    secondaryEmail: report.email_secundario || null,
    website: prospect.website,
    city: prospect.city,
    state: prospect.state,
    neighborhood: report.bairro || null,
    source,
    score: prospect.lead_score,
    status: statusMap[prospect.status] || "novo",
    folderId: slugify(folderName),
    folderName,
    assignedTo: prospect.assigned_user_name || null,
    assignedUserId: prospect.assigned_user_id || null,
    googleMapsUrl: prospect.google_maps_url,
    lastContactAt: prospect.last_contact_date,
    createdAt: prospect.created_at,
    updatedAt: prospect.updated_at,
    metadata: {
      contactName: report.contactName || null,
      origin: report.source || report.origem || "manual",
      crmSent: Boolean(report.crmSent),
      crmSentAt: report.crmSentAt || null,
      labels: normalizeLabels(prospect.labels),
      address: report.address || prospect.address || null,
      linkedin: report.linkedin || null,
      sector: report.sector || null,
      revenue: report.revenue || null,
      employees: report.employees || null,
      budget: report.budget || null,
      notes: report.notes || null,
      nextMeetingAt: report.nextMeetingAt || null,
      meetingOwner: report.meetingOwner || null,
      assignedUserId: prospect.assigned_user_id || null,
      documents: report.documents || [],
    },
  };
}
