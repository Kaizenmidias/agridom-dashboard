import type { Lead, LeadSource, LeadStatus } from "@/types/lead";
import type { Prospect, ProspectStatus } from "@/types/database";
import { buildWhatsAppUrl } from "@/utils/whatsapp";
import { slugify } from "@/utils/lead-formatters";

type ProspectAnalysisReport = {
  folderName?: string | null;
  source?: string | null;
  origem?: string | null;
  responsible?: string | null;
  assignedTo?: string | null;
  email_secundario?: string | null;
  bairro?: string | null;
};

const statusMap: Record<ProspectStatus, LeadStatus> = {
  Novo: "novo",
  "Contato Enviado": "em_contato",
  Respondeu: "em_contato",
  Interessado: "qualificado",
  "Reuniao Agendada": "reuniao",
  "Proposta Enviada": "proposta",
  Fechado: "convertido",
  Perdido: "perdido",
};

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
  const report = (prospect.analysis_report || {}) as ProspectAnalysisReport;
  const folderName = report.folderName || (prospect.website_exists ? "Qualificados" : "Sem Site");
  const source = mapSource(report.source || report.origem || "google_maps");

  return {
    id: String(prospect.id),
    companyName: prospect.business_name,
    contactName: null,
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
    assignedTo: report.assignedTo || report.responsible || null,
    googleMapsUrl: prospect.google_maps_url,
    lastContactAt: prospect.last_contact_date,
    createdAt: prospect.created_at,
    updatedAt: prospect.updated_at,
  };
}

