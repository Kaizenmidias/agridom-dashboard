import { buildApiUrl } from "@/config/api";
import { prospectToLead } from "@/services/leads/lead-adapter";
import type { Prospect, ProspectContactHistory } from "@/types/database";
import type { Lead } from "@/types/lead";

export async function getLeads(): Promise<Lead[]> {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário nao autenticado");

  const response = await fetch(buildApiUrl("prospection/bootstrap"), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível carregar os leads.");
  }

  const history = ((payload?.history || []) as ProspectContactHistory[]).reduce<Record<string, ProspectContactHistory[]>>((acc, item) => {
    const key = String(item.prospect_id);
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {});

  return ((payload?.prospects || []) as Prospect[]).map((prospect) => ({
    ...prospectToLead(prospect),
    activities: (history[String(prospect.id)] || []).map((item) => ({
      id: String(item.id),
      channel: item.channel,
      subject: item.subject,
      message: item.message,
      recipient: item.recipient,
      deliveryStatus: item.delivery_status,
      createdAt: item.created_at,
    })),
  }));
}

function getHeaders() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não autenticado");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function sendLead(endpoint: string, method: "POST" | "PATCH", lead: Partial<Lead>) {
  const response = await fetch(buildApiUrl(`prospection${endpoint}`), {
    method,
    headers: getHeaders(),
    body: JSON.stringify({
      business_name: lead.companyName,
      contact_name: lead.contactName,
      category: lead.category,
      phone: lead.phone,
      email: lead.email,
      website: lead.website,
      city: lead.city,
      state: lead.state,
      assigned_to: lead.assignedTo,
      source: lead.source || "manual",
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar o lead.");
  return prospectToLead(payload as Prospect);
}

export function createLead(lead: Partial<Lead>) {
  return sendLead("/prospects", "POST", lead);
}

export function updateLead(id: string, lead: Partial<Lead>) {
  return sendLead(`/prospects/${id}`, "PATCH", lead);
}

export async function addLeadToPipeline(id: string) {
  const response = await fetch(buildApiUrl(`prospection/prospects/${id}/add-to-crm`), {
    method: "POST",
    headers: getHeaders(),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Não foi possível adicionar ao Kanban.");
  return prospectToLead(payload as Prospect);
}
