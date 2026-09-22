import { buildApiUrl } from "@/config/api";
import { prospectToLead } from "@/services/leads/lead-adapter";
import type { Prospect } from "@/types/database";
import type { Lead } from "@/types/lead";

export async function getLeads(): Promise<Lead[]> {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuario nao autenticado");

  const response = await fetch(buildApiUrl("prospection/bootstrap"), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Nao foi possivel carregar os leads.");
  }

  return ((payload?.prospects || []) as Prospect[]).map(prospectToLead);
}
