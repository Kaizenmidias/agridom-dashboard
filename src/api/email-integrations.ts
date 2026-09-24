import { buildApiUrl } from "@/config/api";

export type EmailIntegration = {
  provider: "email";
  status: string;
  configured: boolean;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  lastError?: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

function headers(): HeadersInit {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não autenticado");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(`integrations/email${path}`), { ...init, headers: { ...headers(), ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Não foi possível concluir a operação.");
  return payload as T;
}

export const emailIntegrationsAPI = {
  get: () => request<EmailIntegration>(""),
  save: (config: { host: string; port: number; security: string; username: string; password?: string; fromName: string; fromEmail: string; replyTo?: string }) => request<EmailIntegration>("", { method: "PUT", body: JSON.stringify(config) }),
  testConnection: () => request<{ success: boolean; message: string }>("/test-connection", { method: "POST" }),
  testSend: (to: string) => request<{ success: boolean; message: string }>("/test-send", { method: "POST", body: JSON.stringify({ to }) }),
};
