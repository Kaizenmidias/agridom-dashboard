import { buildApiUrl } from "@/config/api";
import type { GmailConnection } from "@/types/prospecting";

function headers(): HeadersInit {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não autenticado");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(`integrations/gmail${path}`), { ...init, headers: { ...headers(), ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Não foi possível concluir a operação Gmail.");
  return payload as T;
}

export const gmailIntegrationsAPI = {
  getStatus: () => request<{ connection: GmailConnection | null }>("/status"),
  start: () => request<{ authorizationUrl: string }>("/oauth/start"),
  reconnect: () => request<{ authorizationUrl: string }>("/reconnect", { method: "POST" }),
  disconnect: () => request<{ success: boolean; locallyDisconnected: boolean; revocationConfirmed: boolean; connection: null }>("/disconnect", { method: "POST" }),
};
